import type { Response } from 'express';
import { prisma } from '../../../../../common/utils/db';
import type { AuthenticatedRequest } from '../../../../../common/http/auth.middleware';
import {
  CreateWarehouseSchema,
  UpdateWarehouseSchema,
  WarehouseListQuerySchema,
} from '../schemas/warehouse.schema';

// Re-export address and inventory location controllers for backwards compatibility
export {
  listWarehouseAddresses,
  createWarehouseAddress,
  updateWarehouseAddress,
  deleteWarehouseAddress,
} from './warehouse-address.controller';

export {
  listInventoryLocations,
  getInventoryLocationById,
  createInventoryLocation,
  updateInventoryLocation,
  adjustInventory,
  deleteInventoryLocation,
} from './inventory-location.controller';

// ===========================================
// WAREHOUSE CONTROLLERS
// ===========================================

export const listWarehouses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
};

export const getWarehouseById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
};

export const createWarehouse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
};

export const updateWarehouse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
};

export const deleteWarehouse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
};
