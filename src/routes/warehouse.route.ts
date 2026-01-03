import { Router, type Response } from 'express';
import { getFulfillmentPrisma } from '../lib/db';
import { requireAuth, requirePermission, type AuthenticatedRequest } from '../middleware/auth';

const prisma = getFulfillmentPrisma();
import {
  CreateWarehouseSchema,
  UpdateWarehouseSchema,
  CreateWarehouseAddressSchema,
  UpdateWarehouseAddressSchema,
  CreateInventoryLocationSchema,
  UpdateInventoryLocationSchema,
  AdjustInventorySchema,
  WarehouseListQuerySchema,
} from '../schemas/fulfillment.schema';

const router: Router = Router();

// ===========================================
// LIST WAREHOUSES
// ===========================================

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = WarehouseListQuerySchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
      return;
    }

    const { page, limit, status } = validation.data;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        include: {
          addresses: true,
          _count: {
            select: {
              shipments: true,
              inventoryLocations: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.warehouse.count({ where }),
    ]);

    res.json({
      data: warehouses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing warehouses:', error);
    res.status(500).json({ error: 'Failed to list warehouses' });
  }
});

// ===========================================
// GET WAREHOUSE BY ID
// ===========================================

router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const warehouse = await prisma.warehouse.findFirst({
      where: {
        OR: [
          { id: parseInt(id as string) || 0 },
          { uuid: id },
          { code: id },
        ],
      },
      include: {
        addresses: true,
        _count: {
          select: {
            shipments: true,
            inventoryLocations: true,
          },
        },
      },
    });

    if (!warehouse) {
      res.status(404).json({ error: 'Warehouse not found' });
      return;
    }

    res.json(warehouse);
  } catch (error) {
    console.error('Error getting warehouse:', error);
    res.status(500).json({ error: 'Failed to get warehouse' });
  }
});

// ===========================================
// CREATE WAREHOUSE (Admin only)
// ===========================================

router.post(
  '/',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = CreateWarehouseSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      // Check for duplicate code
      const existing = await prisma.warehouse.findUnique({
        where: { code: data.code },
      });

      if (existing) {
        res.status(400).json({ error: 'Warehouse code already exists' });
        return;
      }

      const warehouse = await prisma.warehouse.create({
        data: {
          code: data.code,
          name: data.name,
          status: data.status,
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          capabilities: data.capabilities || [],
          cutoffTime: data.cutoffTime,
          timezone: data.timezone,
          processingDays: data.processingDays,
          createdBy: req.user!.id,
          updatedBy: req.user!.id,
        },
      });

      res.status(201).json(warehouse);
    } catch (error) {
      console.error('Error creating warehouse:', error);
      res.status(500).json({ error: 'Failed to create warehouse' });
    }
  }
);

// ===========================================
// UPDATE WAREHOUSE (Admin only)
// ===========================================

router.put(
  '/:id',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const validation = UpdateWarehouseSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      const existingWarehouse = await prisma.warehouse.findFirst({
        where: {
          OR: [
            { id: parseInt(id as string) || 0 },
            { uuid: id },
            { code: id },
          ],
        },
      });

      if (!existingWarehouse) {
        res.status(404).json({ error: 'Warehouse not found' });
        return;
      }

      const warehouse = await prisma.warehouse.update({
        where: { id: existingWarehouse.id },
        data: {
          ...data,
          updatedBy: req.user!.id,
        },
        include: {
          addresses: true,
        },
      });

      res.json(warehouse);
    } catch (error) {
      console.error('Error updating warehouse:', error);
      res.status(500).json({ error: 'Failed to update warehouse' });
    }
  }
);

// ===========================================
// DELETE WAREHOUSE (Admin only)
// ===========================================

router.delete(
  '/:id',
  requireAuth,
  requirePermission('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const warehouse = await prisma.warehouse.findFirst({
        where: {
          OR: [
            { id: parseInt(id as string) || 0 },
            { uuid: id },
            { code: id },
          ],
        },
      });

      if (!warehouse) {
        res.status(404).json({ error: 'Warehouse not found' });
        return;
      }

      // Check for active shipments
      const activeShipments = await prisma.shipment.count({
        where: {
          warehouseId: warehouse.id,
          status: { notIn: ['DELIVERED', 'CANCELLED', 'RETURNED_TO_SENDER'] },
        },
      });

      if (activeShipments > 0) {
        res.status(400).json({ error: 'Cannot delete warehouse with active shipments' });
        return;
      }

      await prisma.warehouse.delete({
        where: { id: warehouse.id },
      });

      res.json({ message: 'Warehouse deleted' });
    } catch (error) {
      console.error('Error deleting warehouse:', error);
      res.status(500).json({ error: 'Failed to delete warehouse' });
    }
  }
);

// ===========================================
// WAREHOUSE ADDRESSES
// ===========================================

router.get('/:id/addresses', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const warehouse = await prisma.warehouse.findFirst({
      where: {
        OR: [
          { id: parseInt(id as string) || 0 },
          { uuid: id },
          { code: id },
        ],
      },
    });

    if (!warehouse) {
      res.status(404).json({ error: 'Warehouse not found' });
      return;
    }

    const addresses = await prisma.warehouseAddress.findMany({
      where: { warehouseId: warehouse.id },
    });

    res.json({
      data: addresses,
      total: addresses.length,
    });
  } catch (error) {
    console.error('Error listing warehouse addresses:', error);
    res.status(500).json({ error: 'Failed to list warehouse addresses' });
  }
});

router.post(
  '/:id/addresses',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const validation = CreateWarehouseAddressSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      const warehouse = await prisma.warehouse.findFirst({
        where: {
          OR: [
            { id: parseInt(id as string) || 0 },
            { uuid: id },
            { code: id },
          ],
        },
      });

      if (!warehouse) {
        res.status(404).json({ error: 'Warehouse not found' });
        return;
      }

      // If setting as default, unset other defaults of same type
      if (data.isDefault) {
        await prisma.warehouseAddress.updateMany({
          where: {
            warehouseId: warehouse.id,
            type: data.type,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      const address = await prisma.warehouseAddress.create({
        data: {
          warehouseId: warehouse.id,
          type: data.type,
          isDefault: data.isDefault,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country,
          phone: data.phone,
          createdBy: req.user!.id,
          updatedBy: req.user!.id,
        },
      });

      res.status(201).json(address);
    } catch (error) {
      console.error('Error creating warehouse address:', error);
      res.status(500).json({ error: 'Failed to create warehouse address' });
    }
  }
);

router.put(
  '/:warehouseId/addresses/:addressId',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { warehouseId, addressId } = req.params;

      const validation = UpdateWarehouseAddressSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      const warehouse = await prisma.warehouse.findFirst({
        where: {
          OR: [
            { id: parseInt(warehouseId as string) || 0 },
            { uuid: warehouseId },
            { code: warehouseId },
          ],
        },
      });

      if (!warehouse) {
        res.status(404).json({ error: 'Warehouse not found' });
        return;
      }

      const existingAddress = await prisma.warehouseAddress.findFirst({
        where: {
          id: parseInt(addressId as string),
          warehouseId: warehouse.id,
        },
      });

      if (!existingAddress) {
        res.status(404).json({ error: 'Address not found' });
        return;
      }

      // If setting as default, unset other defaults of same type
      if (data.isDefault) {
        const addressType = data.type || existingAddress.type;
        await prisma.warehouseAddress.updateMany({
          where: {
            warehouseId: warehouse.id,
            type: addressType,
            isDefault: true,
            id: { not: existingAddress.id },
          },
          data: { isDefault: false },
        });
      }

      const address = await prisma.warehouseAddress.update({
        where: { id: existingAddress.id },
        data: {
          ...data,
          updatedBy: req.user!.id,
        },
      });

      res.json(address);
    } catch (error) {
      console.error('Error updating warehouse address:', error);
      res.status(500).json({ error: 'Failed to update warehouse address' });
    }
  }
);

router.delete(
  '/:warehouseId/addresses/:addressId',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { warehouseId, addressId } = req.params;

      const warehouse = await prisma.warehouse.findFirst({
        where: {
          OR: [
            { id: parseInt(warehouseId as string) || 0 },
            { uuid: warehouseId },
            { code: warehouseId },
          ],
        },
      });

      if (!warehouse) {
        res.status(404).json({ error: 'Warehouse not found' });
        return;
      }

      const address = await prisma.warehouseAddress.findFirst({
        where: {
          id: parseInt(addressId as string),
          warehouseId: warehouse.id,
        },
      });

      if (!address) {
        res.status(404).json({ error: 'Address not found' });
        return;
      }

      await prisma.warehouseAddress.delete({
        where: { id: address.id },
      });

      res.json({ message: 'Address deleted' });
    } catch (error) {
      console.error('Error deleting warehouse address:', error);
      res.status(500).json({ error: 'Failed to delete warehouse address' });
    }
  }
);

// ===========================================
// INVENTORY LOCATIONS
// ===========================================

router.get('/:id/locations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { zone, sku, productId, active } = req.query;

    const warehouse = await prisma.warehouse.findFirst({
      where: {
        OR: [
          { id: parseInt(id as string) || 0 },
          { uuid: id },
          { code: id },
        ],
      },
    });

    if (!warehouse) {
      res.status(404).json({ error: 'Warehouse not found' });
      return;
    }

    const where: Record<string, unknown> = { warehouseId: warehouse.id };
    if (zone) where.zone = zone;
    if (sku) where.sku = sku;
    if (productId) where.productId = productId;
    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;

    const locations = await prisma.inventoryLocation.findMany({
      where,
      orderBy: { locationCode: 'asc' },
    });

    res.json({
      data: locations,
      total: locations.length,
    });
  } catch (error) {
    console.error('Error listing inventory locations:', error);
    res.status(500).json({ error: 'Failed to list inventory locations' });
  }
});

router.get('/:warehouseId/locations/:locationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { warehouseId, locationId } = req.params;

    const warehouse = await prisma.warehouse.findFirst({
      where: {
        OR: [
          { id: parseInt(warehouseId as string) || 0 },
          { uuid: warehouseId },
          { code: warehouseId },
        ],
      },
    });

    if (!warehouse) {
      res.status(404).json({ error: 'Warehouse not found' });
      return;
    }

    const location = await prisma.inventoryLocation.findFirst({
      where: {
        id: parseInt(locationId as string),
        warehouseId: warehouse.id,
      },
    });

    if (!location) {
      res.status(404).json({ error: 'Inventory location not found' });
      return;
    }

    res.json(location);
  } catch (error) {
    console.error('Error getting inventory location:', error);
    res.status(500).json({ error: 'Failed to get inventory location' });
  }
});

router.post(
  '/:id/locations',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage', 'warehouse'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const validation = CreateInventoryLocationSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      const warehouse = await prisma.warehouse.findFirst({
        where: {
          OR: [
            { id: parseInt(id as string) || 0 },
            { uuid: id },
            { code: id },
          ],
        },
      });

      if (!warehouse) {
        res.status(404).json({ error: 'Warehouse not found' });
        return;
      }

      // Check for duplicate location code
      const existing = await prisma.inventoryLocation.findFirst({
        where: {
          warehouseId: warehouse.id,
          locationCode: data.locationCode,
        },
      });

      if (existing) {
        res.status(400).json({ error: 'Location code already exists in this warehouse' });
        return;
      }

      const location = await prisma.inventoryLocation.create({
        data: {
          warehouseId: warehouse.id,
          locationCode: data.locationCode,
          zone: data.zone,
          productId: data.productId,
          variantId: data.variantId,
          sku: data.sku,
          quantity: data.quantity,
          isActive: data.isActive,
          createdBy: req.user!.id,
          updatedBy: req.user!.id,
        },
      });

      res.status(201).json(location);
    } catch (error) {
      console.error('Error creating inventory location:', error);
      res.status(500).json({ error: 'Failed to create inventory location' });
    }
  }
);

router.put(
  '/:warehouseId/locations/:locationId',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage', 'warehouse'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { warehouseId, locationId } = req.params;

      const validation = UpdateInventoryLocationSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const data = validation.data;

      const warehouse = await prisma.warehouse.findFirst({
        where: {
          OR: [
            { id: parseInt(warehouseId as string) || 0 },
            { uuid: warehouseId },
            { code: warehouseId },
          ],
        },
      });

      if (!warehouse) {
        res.status(404).json({ error: 'Warehouse not found' });
        return;
      }

      const existingLocation = await prisma.inventoryLocation.findFirst({
        where: {
          id: parseInt(locationId as string),
          warehouseId: warehouse.id,
        },
      });

      if (!existingLocation) {
        res.status(404).json({ error: 'Inventory location not found' });
        return;
      }

      const location = await prisma.inventoryLocation.update({
        where: { id: existingLocation.id },
        data: {
          ...data,
          updatedBy: req.user!.id,
        },
      });

      res.json(location);
    } catch (error) {
      console.error('Error updating inventory location:', error);
      res.status(500).json({ error: 'Failed to update inventory location' });
    }
  }
);

router.post(
  '/:warehouseId/locations/:locationId/adjust',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage', 'warehouse'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { warehouseId, locationId } = req.params;

      const validation = AdjustInventorySchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
        return;
      }

      const { quantity, reason } = validation.data;

      const warehouse = await prisma.warehouse.findFirst({
        where: {
          OR: [
            { id: parseInt(warehouseId as string) || 0 },
            { uuid: warehouseId },
            { code: warehouseId },
          ],
        },
      });

      if (!warehouse) {
        res.status(404).json({ error: 'Warehouse not found' });
        return;
      }

      const existingLocation = await prisma.inventoryLocation.findFirst({
        where: {
          id: parseInt(locationId as string),
          warehouseId: warehouse.id,
        },
      });

      if (!existingLocation) {
        res.status(404).json({ error: 'Inventory location not found' });
        return;
      }

      const newQuantity = existingLocation.quantity + quantity;
      if (newQuantity < 0) {
        res.status(400).json({ error: 'Adjustment would result in negative quantity' });
        return;
      }

      const location = await prisma.inventoryLocation.update({
        where: { id: existingLocation.id },
        data: {
          quantity: newQuantity,
          updatedBy: req.user!.id,
        },
      });

      res.json({
        location,
        adjustment: {
          previousQuantity: existingLocation.quantity,
          adjustedBy: quantity,
          newQuantity,
          reason,
          adjustedAt: new Date(),
          adjustedByUser: req.user!.id,
        },
      });
    } catch (error) {
      console.error('Error adjusting inventory:', error);
      res.status(500).json({ error: 'Failed to adjust inventory' });
    }
  }
);

router.delete(
  '/:warehouseId/locations/:locationId',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { warehouseId, locationId } = req.params;

      const warehouse = await prisma.warehouse.findFirst({
        where: {
          OR: [
            { id: parseInt(warehouseId as string) || 0 },
            { uuid: warehouseId },
            { code: warehouseId },
          ],
        },
      });

      if (!warehouse) {
        res.status(404).json({ error: 'Warehouse not found' });
        return;
      }

      const location = await prisma.inventoryLocation.findFirst({
        where: {
          id: parseInt(locationId as string),
          warehouseId: warehouse.id,
        },
      });

      if (!location) {
        res.status(404).json({ error: 'Inventory location not found' });
        return;
      }

      if (location.quantity > 0) {
        res.status(400).json({ error: 'Cannot delete location with inventory. Adjust quantity to 0 first.' });
        return;
      }

      await prisma.inventoryLocation.delete({
        where: { id: location.id },
      });

      res.json({ message: 'Inventory location deleted' });
    } catch (error) {
      console.error('Error deleting inventory location:', error);
      res.status(500).json({ error: 'Failed to delete inventory location' });
    }
  }
);

export default router;
