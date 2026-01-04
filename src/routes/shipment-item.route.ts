import { Router, type Response } from 'express';
import { prisma } from '../common/utils/db';
import { requireAuth, requirePermission, type AuthenticatedRequest } from '../common/http/auth.middleware';
import { AddShipmentItemSchema } from '../schemas/fulfillment.schema';
import { getSiteId, requireSiteId, shipmentWhere } from '../utils/tenant.utils';

const router: Router = Router();

// ===========================================
// HELPER: Find shipment by various identifiers
// ===========================================

async function findShipment(id: string, siteId: string | undefined, strict = false) {
  return prisma.shipment.findFirst({
    where: shipmentWhere(siteId, {
      OR: [
        { id: parseInt(id) || 0 },
        { uuid: id },
        { shipmentNumber: id },
      ],
    }, { strict }),
  });
}

// ===========================================
// LIST SHIPMENT ITEMS
// ===========================================

/**
 * @openapi
 * /shipment-items/{shipmentId}:
 *   get:
 *     summary: List shipment items
 *     description: Get all items in a shipment
 *     tags:
 *       - Shipment Items
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: shipmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shipment ID, UUID, or shipment number
 *     responses:
 *       200:
 *         description: List of shipment items
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Shipment not found
 */
router.get('/:shipmentId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const siteId = getSiteId(req);

    const shipment = await findShipment(shipmentId as string, siteId);
    if (!shipment) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    const items = await prisma.shipmentItem.findMany({
      where: { shipmentId: shipment.id },
    });

    res.json({
      data: items,
      total: items.length,
    });
  } catch (error) {
    console.error('Error listing shipment items:', error);
    res.status(500).json({ error: 'Failed to list shipment items' });
  }
});

// ===========================================
// ADD SHIPMENT ITEM
// ===========================================

/**
 * @openapi
 * /shipment-items/{shipmentId}:
 *   post:
 *     summary: Add item to shipment
 *     description: Add a new item to a shipment (admin/fulfillment only, only before shipping)
 *     tags:
 *       - Shipment Items
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: shipmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shipment ID, UUID, or shipment number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - sku
 *               - name
 *               - quantity
 *             properties:
 *               orderItemId:
 *                 type: string
 *               productId:
 *                 type: string
 *               variantId:
 *                 type: string
 *               sku:
 *                 type: string
 *               name:
 *                 type: string
 *               quantity:
 *                 type: integer
 *               weightOz:
 *                 type: number
 *               serialNumbers:
 *                 type: array
 *                 items:
 *                   type: string
 *               lotNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Item added successfully
 *       400:
 *         description: Validation error or cannot add in current status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Shipment not found
 */
router.post(
  '/:shipmentId',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { shipmentId } = req.params;

      const validation = AddShipmentItemSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;
      const siteId = requireSiteId(req);

      const shipment = await findShipment(shipmentId as string, siteId, true);
      if (!shipment) {
        res.status(404).json({ error: 'Shipment not found' });
        return;
      }

      if (!['PENDING', 'PROCESSING'].includes(shipment.status)) {
        res.status(400).json({ error: 'Cannot add items in current status' });
        return;
      }

      const item = await prisma.shipmentItem.create({
        data: {
          shipmentId: shipment.id,
          orderItemId: data.orderItemId,
          productId: data.productId,
          variantId: data.variantId,
          sku: data.sku,
          name: data.name,
          quantity: data.quantity,
          weightOz: data.weightOz,
          serialNumbers: data.serialNumbers || [],
          lotNumber: data.lotNumber,
          createdBy: req.user!.id,
          updatedBy: req.user!.id,
        },
      });

      res.status(201).json(item);
    } catch (error) {
      console.error('Error adding shipment item:', error);
      res.status(500).json({ error: 'Failed to add shipment item' });
    }
  }
);

// ===========================================
// DELETE SHIPMENT ITEM
// ===========================================

/**
 * @openapi
 * /shipment-items/{shipmentId}/{itemId}:
 *   delete:
 *     summary: Remove item from shipment
 *     description: Delete an item from a shipment (admin/fulfillment only, only before shipping)
 *     tags:
 *       - Shipment Items
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: shipmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shipment ID, UUID, or shipment number
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shipment item ID
 *     responses:
 *       200:
 *         description: Item deleted successfully
 *       400:
 *         description: Cannot delete in current status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Shipment or item not found
 */
router.delete(
  '/:shipmentId/:itemId',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { shipmentId, itemId } = req.params;
      const siteId = requireSiteId(req);

      const shipment = await findShipment(shipmentId as string, siteId, true);
      if (!shipment) {
        res.status(404).json({ error: 'Shipment not found' });
        return;
      }

      if (!['PENDING', 'PROCESSING'].includes(shipment.status)) {
        res.status(400).json({ error: 'Cannot remove items in current status' });
        return;
      }

      const item = await prisma.shipmentItem.findFirst({
        where: {
          id: parseInt(itemId as string),
          shipmentId: shipment.id,
        },
      });

      if (!item) {
        res.status(404).json({ error: 'Shipment item not found' });
        return;
      }

      await prisma.shipmentItem.delete({
        where: { id: item.id },
      });

      res.json({ message: 'Shipment item deleted' });
    } catch (error) {
      console.error('Error deleting shipment item:', error);
      res.status(500).json({ error: 'Failed to delete shipment item' });
    }
  }
);

export default router;
