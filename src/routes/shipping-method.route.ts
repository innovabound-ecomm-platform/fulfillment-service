import { Router, type Request, type Response } from 'express';
import { getFulfillmentPrisma } from '../lib/db';
import { requireAuth, requirePermission, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';

const prisma = getFulfillmentPrisma();
import {
  CreateShippingMethodSchema,
  UpdateShippingMethodSchema,
  CreateShippingRateSchema,
  UpdateShippingRateSchema,
  CalculateRatesSchema,
} from '../schemas/fulfillment.schema';

const router = Router();

// ===========================================
// LIST SHIPPING METHODS
// ===========================================

router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { active } = req.query;

    const where: Record<string, unknown> = {};
    if (active === 'true') where.isActive = true;

    const methods = await prisma.shippingMethod.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    res.json({
      data: methods,
      total: methods.length,
    });
  } catch (error) {
    console.error('Error listing shipping methods:', error);
    res.status(500).json({ error: 'Failed to list shipping methods' });
  }
});

// ===========================================
// GET SHIPPING METHOD BY ID
// ===========================================

router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const method = await prisma.shippingMethod.findFirst({
      where: {
        OR: [
          { id: parseInt(id as string) || 0 },
          { uuid: id },
          { code: id },
        ],
      },
    });

    if (!method) {
      res.status(404).json({ error: 'Shipping method not found' });
      return;
    }

    res.json(method);
  } catch (error) {
    console.error('Error getting shipping method:', error);
    res.status(500).json({ error: 'Failed to get shipping method' });
  }
});

// ===========================================
// CREATE SHIPPING METHOD (Admin only)
// ===========================================

router.post(
  '/',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = CreateShippingMethodSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      // Check for duplicate code
      const existing = await prisma.shippingMethod.findUnique({
        where: { code: data.code },
      });

      if (existing) {
        res.status(400).json({ error: 'Shipping method code already exists' });
        return;
      }

      const method = await prisma.shippingMethod.create({
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
          carrier: data.carrier,
          carrierServiceCode: data.carrierServiceCode,
          baseCost: data.baseCost,
          costPerOz: data.costPerOz,
          freeShippingMin: data.freeShippingMin,
          minDays: data.minDays,
          maxDays: data.maxDays,
          isActive: data.isActive,
          maxWeight: data.maxWeight,
          countriesAllowed: data.countriesAllowed || [],
          countriesBlocked: data.countriesBlocked || [],
          sortOrder: data.sortOrder,
          createdBy: req.user!.id,
          updatedBy: req.user!.id,
        },
      });

      res.status(201).json(method);
    } catch (error) {
      console.error('Error creating shipping method:', error);
      res.status(500).json({ error: 'Failed to create shipping method' });
    }
  }
);

// ===========================================
// UPDATE SHIPPING METHOD (Admin only)
// ===========================================

router.put(
  '/:id',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const validation = UpdateShippingMethodSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      const existingMethod = await prisma.shippingMethod.findFirst({
        where: {
          OR: [
            { id: parseInt(id as string) || 0 },
            { uuid: id },
            { code: id },
          ],
        },
      });

      if (!existingMethod) {
        res.status(404).json({ error: 'Shipping method not found' });
        return;
      }

      const method = await prisma.shippingMethod.update({
        where: { id: existingMethod.id },
        data: {
          ...data,
          updatedBy: req.user!.id,
        },
      });

      res.json(method);
    } catch (error) {
      console.error('Error updating shipping method:', error);
      res.status(500).json({ error: 'Failed to update shipping method' });
    }
  }
);

// ===========================================
// DELETE SHIPPING METHOD (Admin only)
// ===========================================

router.delete(
  '/:id',
  requireAuth,
  requirePermission('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const method = await prisma.shippingMethod.findFirst({
        where: {
          OR: [
            { id: parseInt(id as string) || 0 },
            { uuid: id },
            { code: id },
          ],
        },
      });

      if (!method) {
        res.status(404).json({ error: 'Shipping method not found' });
        return;
      }

      // Soft delete by deactivating
      await prisma.shippingMethod.update({
        where: { id: method.id },
        data: {
          isActive: false,
          updatedBy: req.user!.id,
        },
      });

      res.json({ message: 'Shipping method deactivated' });
    } catch (error) {
      console.error('Error deleting shipping method:', error);
      res.status(500).json({ error: 'Failed to delete shipping method' });
    }
  }
);

export default router;
