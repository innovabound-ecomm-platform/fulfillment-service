import { Router, type Response } from 'express';
import { prisma } from '@innovabound-ecomm-platform/fulfillment-db';
import { requireAuth, requirePermission, type AuthenticatedRequest } from '../middleware/auth';
import {
  CreateFulfillmentOrderSchema,
  AssignFulfillmentOrderSchema,
  PickItemSchema,
  FulfillmentOrderListQuerySchema,
} from '../schemas/fulfillment.schema';

const router = Router();

// ===========================================
// LIST FULFILLMENT ORDERS
// ===========================================

router.get(
  '/',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage', 'warehouse'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = FulfillmentOrderListQuerySchema.safeParse(req.query);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const { page, limit, status, warehouseId, orderId, assignedTo, priority } = validation.data;

      const where: Record<string, unknown> = {};

      if (status) where.status = status;
      if (warehouseId) where.warehouseId = warehouseId;
      if (orderId) where.orderId = orderId;
      if (assignedTo) where.assignedTo = assignedTo;
      if (priority) where.priority = priority;

      const [orders, total] = await Promise.all([
        prisma.fulfillmentOrder.findMany({
          where,
          include: {
            items: true,
          },
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'asc' },
          ],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.fulfillmentOrder.count({ where }),
      ]);

      res.json({
        data: orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error listing fulfillment orders:', error);
      res.status(500).json({ error: 'Failed to list fulfillment orders' });
    }
  }
);

// ===========================================
// GET FULFILLMENT ORDER BY ID
// ===========================================

router.get(
  '/:id',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage', 'warehouse'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const order = await prisma.fulfillmentOrder.findFirst({
        where: {
          OR: [
            { id: parseInt(id) || 0 },
            { uuid: id },
          ],
        },
        include: {
          items: true,
        },
      });

      if (!order) {
        res.status(404).json({ error: 'Fulfillment order not found' });
        return;
      }

      res.json(order);
    } catch (error) {
      console.error('Error getting fulfillment order:', error);
      res.status(500).json({ error: 'Failed to get fulfillment order' });
    }
  }
);

// ===========================================
// CREATE FULFILLMENT ORDER
// ===========================================

router.post(
  '/',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = CreateFulfillmentOrderSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      // Verify warehouse exists
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: data.warehouseId },
      });

      if (!warehouse) {
        res.status(400).json({ error: 'Warehouse not found' });
        return;
      }

      const order = await prisma.fulfillmentOrder.create({
        data: {
          orderId: data.orderId,
          warehouseId: data.warehouseId,
          priority: data.priority,
          status: 'pending',
          createdBy: req.user!.id,
          updatedBy: req.user!.id,
          items: {
            create: data.items.map((item) => ({
              orderItemId: item.orderItemId,
              productId: item.productId,
              variantId: item.variantId,
              sku: item.sku,
              quantityRequested: item.quantityRequested,
              createdBy: req.user!.id,
              updatedBy: req.user!.id,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      res.status(201).json(order);
    } catch (error) {
      console.error('Error creating fulfillment order:', error);
      res.status(500).json({ error: 'Failed to create fulfillment order' });
    }
  }
);

// ===========================================
// ASSIGN FULFILLMENT ORDER
// ===========================================

router.post(
  '/:id/assign',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage', 'warehouse'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const validation = AssignFulfillmentOrderSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const { assignedTo } = validation.data;

      const existingOrder = await prisma.fulfillmentOrder.findFirst({
        where: {
          OR: [
            { id: parseInt(id) || 0 },
            { uuid: id },
          ],
        },
      });

      if (!existingOrder) {
        res.status(404).json({ error: 'Fulfillment order not found' });
        return;
      }

      if (existingOrder.status !== 'pending') {
        res.status(400).json({ error: 'Can only assign pending orders' });
        return;
      }

      const order = await prisma.fulfillmentOrder.update({
        where: { id: existingOrder.id },
        data: {
          assignedTo,
          assignedAt: new Date(),
          updatedBy: req.user!.id,
        },
        include: {
          items: true,
        },
      });

      res.json(order);
    } catch (error) {
      console.error('Error assigning fulfillment order:', error);
      res.status(500).json({ error: 'Failed to assign fulfillment order' });
    }
  }
);

// ===========================================
// START PICKING
// ===========================================

router.post(
  '/:id/start',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage', 'warehouse'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existingOrder = await prisma.fulfillmentOrder.findFirst({
        where: {
          OR: [
            { id: parseInt(id) || 0 },
            { uuid: id },
          ],
        },
      });

      if (!existingOrder) {
        res.status(404).json({ error: 'Fulfillment order not found' });
        return;
      }

      if (existingOrder.status !== 'pending') {
        res.status(400).json({ error: 'Can only start pending orders' });
        return;
      }

      const order = await prisma.fulfillmentOrder.update({
        where: { id: existingOrder.id },
        data: {
          status: 'in_progress',
          startedAt: new Date(),
          assignedTo: existingOrder.assignedTo || req.user!.id,
          assignedAt: existingOrder.assignedAt || new Date(),
          updatedBy: req.user!.id,
        },
        include: {
          items: true,
        },
      });

      res.json(order);
    } catch (error) {
      console.error('Error starting fulfillment order:', error);
      res.status(500).json({ error: 'Failed to start fulfillment order' });
    }
  }
);

// ===========================================
// PICK ITEM
// ===========================================

router.post(
  '/:id/items/:itemId/pick',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage', 'warehouse'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, itemId } = req.params;

      const validation = PickItemSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const { quantityPicked, pickedFromLocation } = validation.data;

      const existingOrder = await prisma.fulfillmentOrder.findFirst({
        where: {
          OR: [
            { id: parseInt(id) || 0 },
            { uuid: id },
          ],
        },
      });

      if (!existingOrder) {
        res.status(404).json({ error: 'Fulfillment order not found' });
        return;
      }

      if (existingOrder.status !== 'in_progress') {
        res.status(400).json({ error: 'Order must be in progress to pick items' });
        return;
      }

      const existingItem = await prisma.fulfillmentOrderItem.findFirst({
        where: {
          id: parseInt(itemId),
          fulfillmentOrderId: existingOrder.id,
        },
      });

      if (!existingItem) {
        res.status(404).json({ error: 'Fulfillment order item not found' });
        return;
      }

      if (quantityPicked > existingItem.quantityRequested) {
        res.status(400).json({ error: 'Picked quantity exceeds requested quantity' });
        return;
      }

      const item = await prisma.fulfillmentOrderItem.update({
        where: { id: existingItem.id },
        data: {
          quantityPicked,
          pickedFromLocation,
          isPicked: quantityPicked > 0,
          pickedAt: quantityPicked > 0 ? new Date() : null,
          updatedBy: req.user!.id,
        },
      });

      res.json(item);
    } catch (error) {
      console.error('Error picking item:', error);
      res.status(500).json({ error: 'Failed to pick item' });
    }
  }
);

// ===========================================
// COMPLETE FULFILLMENT ORDER
// ===========================================

router.post(
  '/:id/complete',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage', 'warehouse'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existingOrder = await prisma.fulfillmentOrder.findFirst({
        where: {
          OR: [
            { id: parseInt(id) || 0 },
            { uuid: id },
          ],
        },
        include: {
          items: true,
        },
      });

      if (!existingOrder) {
        res.status(404).json({ error: 'Fulfillment order not found' });
        return;
      }

      if (existingOrder.status !== 'in_progress') {
        res.status(400).json({ error: 'Can only complete orders that are in progress' });
        return;
      }

      // Check if all items are picked
      const unPickedItems = existingOrder.items.filter((item) => !item.isPicked);
      if (unPickedItems.length > 0) {
        res.status(400).json({
          error: 'All items must be picked before completing',
          unPickedItems: unPickedItems.map((i) => i.id),
        });
        return;
      }

      const order = await prisma.fulfillmentOrder.update({
        where: { id: existingOrder.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          updatedBy: req.user!.id,
        },
        include: {
          items: true,
        },
      });

      res.json(order);
    } catch (error) {
      console.error('Error completing fulfillment order:', error);
      res.status(500).json({ error: 'Failed to complete fulfillment order' });
    }
  }
);

// ===========================================
// CANCEL FULFILLMENT ORDER
// ===========================================

router.post(
  '/:id/cancel',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const existingOrder = await prisma.fulfillmentOrder.findFirst({
        where: {
          OR: [
            { id: parseInt(id) || 0 },
            { uuid: id },
          ],
        },
      });

      if (!existingOrder) {
        res.status(404).json({ error: 'Fulfillment order not found' });
        return;
      }

      if (existingOrder.status === 'completed') {
        res.status(400).json({ error: 'Cannot cancel completed orders' });
        return;
      }

      const order = await prisma.fulfillmentOrder.update({
        where: { id: existingOrder.id },
        data: {
          status: 'cancelled',
          updatedBy: req.user!.id,
        },
        include: {
          items: true,
        },
      });

      res.json(order);
    } catch (error) {
      console.error('Error cancelling fulfillment order:', error);
      res.status(500).json({ error: 'Failed to cancel fulfillment order' });
    }
  }
);

// ===========================================
// GET PICK QUEUE
// ===========================================

router.get(
  '/queue',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage', 'warehouse'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { warehouseId, assignedTo } = req.query;

      const where: Record<string, unknown> = {
        status: { in: ['pending', 'in_progress'] },
      };

      if (warehouseId) where.warehouseId = parseInt(warehouseId as string);
      if (assignedTo) where.assignedTo = assignedTo;

      const orders = await prisma.fulfillmentOrder.findMany({
        where,
        include: {
          items: true,
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      });

      res.json({
        data: orders,
        total: orders.length,
        summary: {
          pending: orders.filter((o) => o.status === 'pending').length,
          inProgress: orders.filter((o) => o.status === 'in_progress').length,
        },
      });
    } catch (error) {
      console.error('Error getting pick queue:', error);
      res.status(500).json({ error: 'Failed to get pick queue' });
    }
  }
);

export default router;
