import { Router, type Response } from 'express';
import { prisma } from '../common/utils/db';
import { requireAuth, requirePermission, type AuthenticatedRequest } from '../common/http/auth.middleware';
import { AddTrackingEventSchema } from '../schemas/fulfillment.schema';

const router: Router = Router();

// ===========================================
// GET TRACKING EVENTS
// ===========================================

/**
 * @openapi
 * /tracking/{id}:
 *   get:
 *     summary: Get tracking events
 *     description: Retrieve all tracking events for a shipment
 *     tags:
 *       - Tracking
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
 *         description: List of tracking events
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
    });

    if (!shipment) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    const events = await prisma.trackingEvent.findMany({
      where: { shipmentId: shipment.id },
      orderBy: { occurredAt: 'desc' },
    });

    res.json({
      data: events,
      total: events.length,
      shipment: {
        id: shipment.uuid,
        shipmentNumber: shipment.shipmentNumber,
        trackingNumber: shipment.trackingNumber,
        status: shipment.status,
        carrier: shipment.carrier,
      },
    });
  } catch (error) {
    console.error('Error getting tracking events:', error);
    res.status(500).json({ error: 'Failed to get tracking events' });
  }
});

// ===========================================
// ADD TRACKING EVENT
// ===========================================

/**
 * @openapi
 * /tracking/{id}:
 *   post:
 *     summary: Add tracking event
 *     description: Add a new tracking event to a shipment (admin/fulfillment/service only)
 *     tags:
 *       - Tracking
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *               - eventDescription
 *             properties:
 *               eventType:
 *                 type: string
 *                 enum: [LABEL_CREATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, DELIVERY_ATTEMPTED, EXCEPTION, RETURNED, OTHER]
 *               eventCode:
 *                 type: string
 *               eventDescription:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               country:
 *                 type: string
 *               occurredAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Tracking event added
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Shipment not found
 */
router.post(
  '/:id',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage', 'service'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const validation = AddTrackingEventSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      const shipment = await prisma.shipment.findFirst({
        where: {
          OR: [
            { id: parseInt(id as string) || 0 },
            { uuid: id },
            { shipmentNumber: id },
            { trackingNumber: id },
          ],
        },
      });

      if (!shipment) {
        res.status(404).json({ error: 'Shipment not found' });
        return;
      }

      const event = await prisma.trackingEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: data.eventType,
          eventCode: data.eventCode,
          eventDescription: data.eventDescription,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country,
          occurredAt: data.occurredAt || new Date(),
          actorUserId: req.user!.id,
          actorType: req.user!.roles?.includes('service') ? 'SERVICE' : 'ADMIN',
          createdBy: req.user!.id,
        },
      });

      // Update shipment status based on event type
      const statusMap: Record<string, string> = {
        IN_TRANSIT: 'IN_TRANSIT',
        OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
        DELIVERED: 'DELIVERED',
        DELIVERY_ATTEMPTED: 'FAILED_ATTEMPT',
        EXCEPTION: 'EXCEPTION',
        RETURNED: 'RETURNED_TO_SENDER',
      };

      const newStatus = statusMap[data.eventType];
      if (newStatus) {
        const updateData: Record<string, unknown> = {
          status: newStatus,
          updatedBy: req.user!.id,
        };

        if (newStatus === 'DELIVERED') {
          updateData.actualDeliveryDate = data.occurredAt || new Date();
        }

        await prisma.shipment.update({
          where: { id: shipment.id },
          data: updateData,
        });
      }

      res.status(201).json(event);
    } catch (error) {
      console.error('Error adding tracking event:', error);
      res.status(500).json({ error: 'Failed to add tracking event' });
    }
  }
);

// ===========================================
// LIST ALL TRACKING EVENTS (Admin)
// ===========================================

/**
 * @openapi
 * /tracking:
 *   get:
 *     summary: List recent tracking events
 *     description: Get recent tracking events across all shipments (admin only)
 *     tags:
 *       - Tracking
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
 *           default: 50
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of tracking events
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const eventType = req.query.eventType as string | undefined;

      const where: Record<string, unknown> = {};
      if (eventType) where.eventType = eventType;

      const [events, total] = await Promise.all([
        prisma.trackingEvent.findMany({
          where,
          include: {
            shipment: {
              select: {
                uuid: true,
                shipmentNumber: true,
                trackingNumber: true,
                carrier: true,
              },
            },
          },
          orderBy: { occurredAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.trackingEvent.count({ where }),
      ]);

      res.json({
        data: events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error listing tracking events:', error);
      res.status(500).json({ error: 'Failed to list tracking events' });
    }
  }
);

export default router;
