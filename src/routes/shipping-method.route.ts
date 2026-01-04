import { Router, type Request, type Response } from 'express';
import { prisma } from '../common/utils/db';
import { requireAuth, requirePermission, optionalAuth, type AuthenticatedRequest } from '../common/http/auth.middleware';
import { getSiteId, requireSiteId, shippingMethodWhere, withSiteId } from '../utils/tenant.utils';

import {
  CreateShippingMethodSchema,
  UpdateShippingMethodSchema,
  CreateShippingRateSchema,
  UpdateShippingRateSchema,
  CalculateRatesSchema,
} from '../schemas/fulfillment.schema';

const router: Router = Router();

// ===========================================
// LIST SHIPPING METHODS
// ===========================================

/**
 * @openapi
 * /shipping-methods:
 *   get:
 *     summary: List shipping methods
 *     description: Get all available shipping methods (public endpoint)
 *     tags:
 *       - Shipping Methods
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of shipping methods
 */
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { active } = req.query;
    const siteId = getSiteId(req as AuthenticatedRequest);

    const additionalWhere: Record<string, unknown> = {};
    if (active === 'true') additionalWhere.isActive = true;

    const where = shippingMethodWhere(siteId, additionalWhere, { strict: false });

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

/**
 * @openapi
 * /shipping-methods/{id}:
 *   get:
 *     summary: Get shipping method by ID
 *     description: Returns shipping method details by ID, UUID, or code (public endpoint)
 *     tags:
 *       - Shipping Methods
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Shipping method ID, UUID, or code
 *     responses:
 *       200:
 *         description: Shipping method details
 *       404:
 *         description: Shipping method not found
 */
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const siteId = getSiteId(req as AuthenticatedRequest);

    const method = await prisma.shippingMethod.findFirst({
      where: shippingMethodWhere(siteId, {
        OR: [
          { id: parseInt(id as string) || 0 },
          { uuid: id },
          { code: id },
        ],
      }, { strict: false }),
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

/**
 * @openapi
 * /shipping-methods:
 *   post:
 *     summary: Create shipping method
 *     description: Create a new shipping method (admin/fulfillment only)
 *     tags:
 *       - Shipping Methods
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
 *               - name
 *               - code
 *               - carrier
 *               - baseCost
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               description:
 *                 type: string
 *               carrier:
 *                 type: string
 *                 enum: [USPS, UPS, FEDEX, DHL, OTHER]
 *               baseCost:
 *                 type: number
 *               costPerOz:
 *                 type: number
 *               freeShippingMin:
 *                 type: number
 *               minDays:
 *                 type: integer
 *               maxDays:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *               maxWeight:
 *                 type: number
 *               countriesAllowed:
 *                 type: array
 *                 items:
 *                   type: string
 *               countriesBlocked:
 *                 type: array
 *                 items:
 *                   type: string
 *               sortOrder:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Shipping method created
 *       400:
 *         description: Validation error or duplicate code
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
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
      const siteId = requireSiteId(req);

      // Check for duplicate code
      const existing = await prisma.shippingMethod.findFirst({
        where: shippingMethodWhere(siteId, { code: data.code }),
      });

      if (existing) {
        res.status(400).json({ error: 'Shipping method code already exists' });
        return;
      }

      const method = await prisma.shippingMethod.create({
        data: withSiteId({
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
        }, siteId),
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

/**
 * @openapi
 * /shipping-methods/{id}:
 *   put:
 *     summary: Update shipping method
 *     description: Update shipping method details (admin/fulfillment only)
 *     tags:
 *       - Shipping Methods
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Shipping method ID, UUID, or code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               baseCost:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Shipping method updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Shipping method not found
 */
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
      const siteId = requireSiteId(req);

      const existingMethod = await prisma.shippingMethod.findFirst({
        where: shippingMethodWhere(siteId, {
          OR: [
            { id: parseInt(id as string) || 0 },
            { uuid: id },
            { code: id },
          ],
        }),
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
      const siteId = requireSiteId(req);

      const method = await prisma.shippingMethod.findFirst({
        where: shippingMethodWhere(siteId, {
          OR: [
            { id: parseInt(id as string) || 0 },
            { uuid: id },
            { code: id },
          ],
        }),
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
