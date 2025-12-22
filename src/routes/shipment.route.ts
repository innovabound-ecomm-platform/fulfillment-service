import { Router, type Response } from 'express';
import { prisma } from '@innovabound-ecomm-platform/fulfillment-db';
import { requireAuth, requirePermission, type AuthenticatedRequest } from '../middleware/auth';
import {
  CreateShipmentSchema,
  UpdateShipmentSchema,
  AddShipmentItemSchema,
  GenerateLabelSchema,
  MarkShippedSchema,
  AddTrackingEventSchema,
  ShipmentListQuerySchema,
} from '../schemas/fulfillment.schema';

const router = Router();

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

router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { id: parseInt(id) || 0 },
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
            { id: parseInt(id) || 0 },
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
            { id: parseInt(id) || 0 },
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
      // For now, simulate label generation
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
            { id: parseInt(id) || 0 },
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
            { id: parseInt(id) || 0 },
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

// ===========================================
// GET TRACKING EVENTS
// ===========================================

router.get('/:id/tracking', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { id: parseInt(id) || 0 },
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

router.post(
  '/:id/tracking',
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
            { id: parseInt(id) || 0 },
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
          actorType: req.user!.roles.includes('service') ? 'SERVICE' : 'ADMIN',
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
// SHIPMENT ITEMS
// ===========================================

router.get('/:id/items', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { id: parseInt(id) || 0 },
          { uuid: id },
          { shipmentNumber: id },
        ],
      },
    });

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

router.post(
  '/:id/items',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const validation = AddShipmentItemSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      const shipment = await prisma.shipment.findFirst({
        where: {
          OR: [
            { id: parseInt(id) || 0 },
            { uuid: id },
            { shipmentNumber: id },
          ],
        },
      });

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

router.delete(
  '/:shipmentId/items/:itemId',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { shipmentId, itemId } = req.params;

      const shipment = await prisma.shipment.findFirst({
        where: {
          OR: [
            { id: parseInt(shipmentId) || 0 },
            { uuid: shipmentId },
            { shipmentNumber: shipmentId },
          ],
        },
      });

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
          id: parseInt(itemId),
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
