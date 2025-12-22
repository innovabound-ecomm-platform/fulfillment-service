import { Router, type Request, type Response } from 'express';
import { prisma } from '@innovabound-ecomm-platform/fulfillment-db';
import { requireAuth, requirePermission, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import {
  CreateShippingRateSchema,
  UpdateShippingRateSchema,
  CalculateRatesSchema,
} from '../schemas/fulfillment.schema';

const router = Router();

// ===========================================
// CALCULATE SHIPPING RATES
// ===========================================

router.post('/calculate', optionalAuth, async (req: Request, res: Response) => {
  try {
    const validation = CalculateRatesSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
      return;
    }

    const { originCountry, destCountry, destState, weightOz, cartTotal } = validation.data;

    // Get active shipping methods
    const methods = await prisma.shippingMethod.findMany({
      where: { isActive: true },
      orderBy: [
        { sortOrder: 'asc' },
        { baseCost: 'asc' },
      ],
    });

    const rates = [];

    for (const method of methods) {
      // Check weight limit
      if (method.maxWeight && weightOz > method.maxWeight) {
        continue;
      }

      // Check country restrictions
      const countriesAllowed = method.countriesAllowed as string[];
      const countriesBlocked = method.countriesBlocked as string[];

      if (countriesAllowed.length > 0 && !countriesAllowed.includes(destCountry)) {
        continue;
      }

      if (countriesBlocked.includes(destCountry)) {
        continue;
      }

      // Calculate rate
      let rate = method.baseCost;

      // Add per-ounce cost if applicable
      if (method.costPerOz) {
        rate += method.costPerOz * weightOz;
      }

      // Check for zone-based rate override
      const zoneRate = await prisma.shippingRate.findFirst({
        where: {
          shippingMethodId: method.id,
          originCountry,
          destCountry,
          minWeight: { lte: weightOz },
          maxWeight: { gte: weightOz },
          isActive: true,
          OR: [
            { destRegion: null },
            { destRegion: destState || null },
          ],
        },
        orderBy: { destRegion: 'desc' }, // Prefer region-specific rates
      });

      if (zoneRate) {
        rate = zoneRate.rate;
      }

      // Check for free shipping
      const isFreeShipping = method.freeShippingMin && cartTotal && cartTotal >= method.freeShippingMin;

      rates.push({
        methodId: method.uuid,
        methodCode: method.code,
        name: method.name,
        description: method.description,
        carrier: method.carrier,
        rate: isFreeShipping ? 0 : rate,
        originalRate: rate,
        isFreeShipping,
        freeShippingThreshold: method.freeShippingMin,
        minDays: method.minDays,
        maxDays: method.maxDays,
        estimatedDelivery: `${method.minDays}-${method.maxDays} business days`,
      });
    }

    res.json({
      data: rates,
      total: rates.length,
      request: {
        originCountry,
        destCountry,
        destState,
        weightOz,
        cartTotal,
      },
    });
  } catch (error) {
    console.error('Error calculating rates:', error);
    res.status(500).json({ error: 'Failed to calculate shipping rates' });
  }
});

// ===========================================
// LIST SHIPPING RATES (Admin only)
// ===========================================

router.get(
  '/',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { shippingMethodId, originCountry, destCountry, active } = req.query;

      const where: Record<string, unknown> = {};

      if (shippingMethodId) where.shippingMethodId = parseInt(shippingMethodId as string);
      if (originCountry) where.originCountry = originCountry;
      if (destCountry) where.destCountry = destCountry;
      if (active === 'true') where.isActive = true;
      if (active === 'false') where.isActive = false;

      const rates = await prisma.shippingRate.findMany({
        where,
        orderBy: [
          { originCountry: 'asc' },
          { destCountry: 'asc' },
          { minWeight: 'asc' },
        ],
      });

      res.json({
        data: rates,
        total: rates.length,
      });
    } catch (error) {
      console.error('Error listing shipping rates:', error);
      res.status(500).json({ error: 'Failed to list shipping rates' });
    }
  }
);

// ===========================================
// CREATE SHIPPING RATE (Admin only)
// ===========================================

router.post(
  '/',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = CreateShippingRateSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      // Verify shipping method exists
      const method = await prisma.shippingMethod.findUnique({
        where: { id: data.shippingMethodId },
      });

      if (!method) {
        res.status(400).json({ error: 'Shipping method not found' });
        return;
      }

      const rate = await prisma.shippingRate.create({
        data: {
          originCountry: data.originCountry,
          originRegion: data.originRegion,
          destCountry: data.destCountry,
          destRegion: data.destRegion,
          shippingMethodId: data.shippingMethodId,
          minWeight: data.minWeight,
          maxWeight: data.maxWeight,
          rate: data.rate,
          isActive: data.isActive,
          createdBy: req.user!.id,
          updatedBy: req.user!.id,
        },
      });

      res.status(201).json(rate);
    } catch (error) {
      console.error('Error creating shipping rate:', error);
      res.status(500).json({ error: 'Failed to create shipping rate' });
    }
  }
);

// ===========================================
// UPDATE SHIPPING RATE (Admin only)
// ===========================================

router.put(
  '/:id',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const validation = UpdateShippingRateSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      const existingRate = await prisma.shippingRate.findUnique({
        where: { id: parseInt(id) },
      });

      if (!existingRate) {
        res.status(404).json({ error: 'Shipping rate not found' });
        return;
      }

      const rate = await prisma.shippingRate.update({
        where: { id: existingRate.id },
        data: {
          ...data,
          updatedBy: req.user!.id,
        },
      });

      res.json(rate);
    } catch (error) {
      console.error('Error updating shipping rate:', error);
      res.status(500).json({ error: 'Failed to update shipping rate' });
    }
  }
);

// ===========================================
// DELETE SHIPPING RATE (Admin only)
// ===========================================

router.delete(
  '/:id',
  requireAuth,
  requirePermission('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const rate = await prisma.shippingRate.findUnique({
        where: { id: parseInt(id) },
      });

      if (!rate) {
        res.status(404).json({ error: 'Shipping rate not found' });
        return;
      }

      await prisma.shippingRate.delete({
        where: { id: rate.id },
      });

      res.json({ message: 'Shipping rate deleted' });
    } catch (error) {
      console.error('Error deleting shipping rate:', error);
      res.status(500).json({ error: 'Failed to delete shipping rate' });
    }
  }
);

export default router;
