import { Router, type Response } from 'express';
import { prisma } from '../common/utils/db';
import { requireAuth, requirePermission, type AuthenticatedRequest } from '../common/http/auth.middleware';

import {
  CreateShipmentSchema,
  UpdateShipmentSchema,
  GenerateLabelSchema,
  MarkShippedSchema,
  ShipmentListQuerySchema,
} from '../schemas/fulfillment.schema';

const router: Router = Router();

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function generateShipmentNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SHP-${year}-${timestamp}${random}`;
}

// ===========================================
// LIST SHIPMENTS
// ===========================================

/**
 * @openapi
 * /shipments:
 *   get:
 *     summary: List shipments
 *     description: Retrieve a paginated list of shipments with optional filtering
 *     tags:
 *       - Shipments
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PROCESSING, READY_TO_SHIP, SHIPPED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED_ATTEMPT, EXCEPTION, RETURNED_TO_SENDER, CANCELLED]
 *         description: Filter by shipment status
 *       - in: query
 *         name: orderId
 *         schema:
 *           type: string
 *         description: Filter by order ID
 *       - in: query
 *         name: warehouseId
 *         schema:
 *           type: string
 *         description: Filter by warehouse ID
 *       - in: query
 *         name: carrier
 *         schema:
 *           type: string
 *         description: Filter by carrier (USPS, UPS, FEDEX, DHL)
 *     responses:
 *       200:
 *         description: List of shipments
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = ShipmentListQuerySchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
      return;
    }

    const { page, limit, status, orderId, warehouseId, carrier, fromDate, toDate, sortBy, sortOrder } = validation.data;

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (orderId) where.orderId = orderId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (carrier) where.carrier = carrier;

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) (where.createdAt as Record<string, Date>).gte = fromDate;
      if (toDate) (where.createdAt as Record<string, Date>).lte = toDate;
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          items: true,
          warehouse: {
            select: { id: true, code: true, name: true },
          },
          _count: {
            select: { trackingEvents: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.shipment.count({ where }),
    ]);

    res.json({
      data: shipments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing shipments:', error);
    res.status(500).json({ error: 'Failed to list shipments' });
  }
});

// ===========================================
// GET SHIPMENT BY ID
// ===========================================

/**
 * @openapi
 * /shipments/{id}:
 *   get:
 *     summary: Get shipment by ID
 *     description: Returns shipment details by ID, UUID, shipment number, or tracking number
 *     tags:
 *       - Shipments
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Shipment ID, UUID, shipment number, or tracking number
 *     responses:
 *       200:
 *         description: Shipment details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Shipment not found
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { id: parseInt(id as string) || 0 },
          { uuid: id },
          { shipmentNumber: id },
          { trackingNumber: id },
        ],
      },
      include: {
        items: true,
        trackingEvents: {
          orderBy: { occurredAt: 'desc' },
        },
        warehouse: true,
        returnAddress: true,
      },
    });

    if (!shipment) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    res.json(shipment);
  } catch (error) {
    console.error('Error getting shipment:', error);
    res.status(500).json({ error: 'Failed to get shipment' });
  }
});

// ===========================================
// CREATE SHIPMENT
// ===========================================

/**
 * @openapi
 * /shipments:
 *   post:
 *     summary: Create a shipment
 *     description: Create a new shipment with items (admin/fulfillment only)
 *     tags:
 *       - Shipments
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - carrier
 *               - warehouseId
 *               - shipToName
 *               - shipToAddressLine1
 *               - shipToCity
 *               - shipToState
 *               - shipToPostalCode
 *               - shipToCountry
 *     responses:
 *       201:
 *         description: Shipment created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.post(
  '/',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = CreateShipmentSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      const shipment = await prisma.shipment.create({
        data: {
          shipmentNumber: generateShipmentNumber(),
          orderId: data.orderId,
          priority: data.priority,
          carrier: data.carrier,
          carrierName: data.carrierName,
          serviceLevel: data.serviceLevel,
          serviceLevelCode: data.serviceLevelCode,
          warehouseId: data.warehouseId,
          shipToName: data.shipToName,
          shipToCompany: data.shipToCompany,
          shipToAddressLine1: data.shipToAddressLine1,
          shipToAddressLine2: data.shipToAddressLine2,
          shipToCity: data.shipToCity,
          shipToState: data.shipToState,
          shipToPostalCode: data.shipToPostalCode,
          shipToCountry: data.shipToCountry,
          shipToPhone: data.shipToPhone,
          weightOz: data.weightOz,
          lengthIn: data.lengthIn,
          widthIn: data.widthIn,
          heightIn: data.heightIn,
          requiresSignature: data.requiresSignature,
          insuranceAmount: data.insuranceAmount,
          status: 'PENDING',
          createdBy: req.user!.id,
          updatedBy: req.user!.id,
          items: data.items ? {
            create: data.items.map((item) => ({
              orderItemId: item.orderItemId,
              productId: item.productId,
              variantId: item.variantId,
              sku: item.sku,
              name: item.name,
              quantity: item.quantity,
              weightOz: item.weightOz,
              serialNumbers: item.serialNumbers || [],
              lotNumber: item.lotNumber,
              createdBy: req.user!.id,
              updatedBy: req.user!.id,
            })),
          } : undefined,
        },
        include: {
          items: true,
          warehouse: true,
        },
      });

      res.status(201).json(shipment);
    } catch (error) {
      console.error('Error creating shipment:', error);
      res.status(500).json({ error: 'Failed to create shipment' });
    }
  }
);

// ===========================================
// UPDATE SHIPMENT
// ===========================================

/**
 * @openapi
 * /shipments/{id}:
 *   put:
 *     summary: Update a shipment
 *     description: Update shipment details (admin/fulfillment only, only before shipping)
 *     tags:
 *       - Shipments
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Shipment ID, UUID, or shipment number
 *     responses:
 *       200:
 *         description: Shipment updated successfully
 *       400:
 *         description: Validation error or cannot update in current status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Shipment not found
 */
router.put(
  '/:id',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const validation = UpdateShipmentSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      const existingShipment = await prisma.shipment.findFirst({
        where: {
          OR: [
            { id: parseInt(id as string) || 0 },
            { uuid: id },
            { shipmentNumber: id },
          ],
        },
      });

      if (!existingShipment) {
        res.status(404).json({ error: 'Shipment not found' });
        return;
      }

      if (['SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'].includes(existingShipment.status)) {
        res.status(400).json({ error: 'Cannot update shipment in current status' });
        return;
      }

      const shipment = await prisma.shipment.update({
        where: { id: existingShipment.id },
        data: {
          ...data,
          updatedBy: req.user!.id,
        },
        include: {
          items: true,
          warehouse: true,
        },
      });

      res.json(shipment);
    } catch (error) {
      console.error('Error updating shipment:', error);
      res.status(500).json({ error: 'Failed to update shipment' });
    }
  }
);

// ===========================================
// GENERATE SHIPPING LABEL
// ===========================================

/**
 * @openapi
 * /shipments/{id}/label:
 *   post:
 *     summary: Generate shipping label
 *     description: Generate a shipping label for the shipment (admin/fulfillment only)
 *     tags:
 *       - Shipments
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Label generated successfully
 *       400:
 *         description: Validation error or label already exists
 *       404:
 *         description: Shipment not found
 */
router.post(
  '/:id/label',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const validation = GenerateLabelSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      const existingShipment = await prisma.shipment.findFirst({
        where: {
          OR: [
            { id: parseInt(id as string) || 0 },
            { uuid: id },
            { shipmentNumber: id },
          ],
        },
      });

      if (!existingShipment) {
        res.status(404).json({ error: 'Shipment not found' });
        return;
      }

      if (existingShipment.labelUrl) {
        res.status(400).json({ error: 'Shipment already has a label' });
        return;
      }

      // In production, integrate with carrier API (Shippo, EasyPost, etc.)
      const mockTrackingNumber = `${data.carrier}${Date.now()}`;
      const mockLabelUrl = `https://labels.example.com/${mockTrackingNumber}.${data.labelFormat.toLowerCase()}`;

      const shipment = await prisma.shipment.update({
        where: { id: existingShipment.id },
        data: {
          carrier: data.carrier,
          serviceLevel: data.serviceLevel,
          trackingNumber: mockTrackingNumber,
          labelUrl: mockLabelUrl,
          labelFormat: data.labelFormat,
          labelCreatedAt: new Date(),
          status: 'READY_TO_SHIP',
          updatedBy: req.user!.id,
        },
        include: {
          items: true,
        },
      });

      // Add tracking event
      await prisma.trackingEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: 'LABEL_CREATED',
          eventDescription: `Shipping label created for ${data.carrier} ${data.serviceLevel}`,
          actorUserId: req.user!.id,
          actorType: 'ADMIN',
          createdBy: req.user!.id,
        },
      });

      res.json(shipment);
    } catch (error) {
      console.error('Error generating label:', error);
      res.status(500).json({ error: 'Failed to generate label' });
    }
  }
);

// ===========================================
// MARK AS SHIPPED
// ===========================================

/**
 * @openapi
 * /shipments/{id}/ship:
 *   post:
 *     summary: Mark shipment as shipped
 *     description: Record that the shipment has been handed to the carrier
 *     tags:
 *       - Shipments
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shipment marked as shipped
 *       400:
 *         description: Validation error or shipment not ready
 *       404:
 *         description: Shipment not found
 */
router.post(
  '/:id/ship',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const validation = MarkShippedSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      const existingShipment = await prisma.shipment.findFirst({
        where: {
          OR: [
            { id: parseInt(id as string) || 0 },
            { uuid: id },
            { shipmentNumber: id },
          ],
        },
      });

      if (!existingShipment) {
        res.status(404).json({ error: 'Shipment not found' });
        return;
      }

      if (!['PENDING', 'PROCESSING', 'READY_TO_SHIP'].includes(existingShipment.status)) {
        res.status(400).json({ error: 'Shipment is not ready to be shipped' });
        return;
      }

      const shipment = await prisma.shipment.update({
        where: { id: existingShipment.id },
        data: {
          trackingNumber: data.trackingNumber,
          trackingUrl: data.trackingUrl,
          carrier: data.carrier || existingShipment.carrier,
          shippingCost: data.shippingCost,
          status: 'SHIPPED',
          shippedAt: new Date(),
          updatedBy: req.user!.id,
        },
        include: {
          items: true,
        },
      });

      // Add tracking event
      await prisma.trackingEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: 'PICKED_UP',
          eventDescription: 'Package handed to carrier',
          actorUserId: req.user!.id,
          actorType: 'ADMIN',
          createdBy: req.user!.id,
        },
      });

      res.json(shipment);
    } catch (error) {
      console.error('Error marking shipment as shipped:', error);
      res.status(500).json({ error: 'Failed to mark shipment as shipped' });
    }
  }
);

// ===========================================
// CANCEL SHIPMENT
// ===========================================

/**
 * @openapi
 * /shipments/{id}/cancel:
 *   post:
 *     summary: Cancel a shipment
 *     description: Cancel a shipment before it has shipped
 *     tags:
 *       - Shipments
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shipment cancelled
 *       400:
 *         description: Cannot cancel after shipping
 *       404:
 *         description: Shipment not found
 */
router.post(
  '/:id/cancel',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const existingShipment = await prisma.shipment.findFirst({
        where: {
          OR: [
            { id: parseInt(id as string) || 0 },
            { uuid: id },
            { shipmentNumber: id },
          ],
        },
      });

      if (!existingShipment) {
        res.status(404).json({ error: 'Shipment not found' });
        return;
      }

      if (['SHIPPED', 'IN_TRANSIT', 'DELIVERED'].includes(existingShipment.status)) {
        res.status(400).json({ error: 'Cannot cancel shipment after it has shipped' });
        return;
      }

      const shipment = await prisma.shipment.update({
        where: { id: existingShipment.id },
        data: {
          status: 'CANCELLED',
          updatedBy: req.user!.id,
        },
      });

      // Add tracking event
      await prisma.trackingEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: 'OTHER',
          eventCode: 'CANCELLED',
          eventDescription: reason || 'Shipment cancelled',
          actorUserId: req.user!.id,
          actorType: 'ADMIN',
          createdBy: req.user!.id,
        },
      });

      res.json(shipment);
    } catch (error) {
      console.error('Error cancelling shipment:', error);
      res.status(500).json({ error: 'Failed to cancel shipment' });
    }
  }
);

export default router;
