import type { Response } from 'express';
import { prisma } from '../../../../../common/utils/db';
import type { AuthenticatedRequest } from '../../../../../common/http/auth.middleware';
import {
  CreateInventoryLocationSchema,
  UpdateInventoryLocationSchema,
  AdjustInventorySchema,
} from '../schemas/warehouse.schema';
import { getSiteId, requireSiteId, warehouseWhere } from '../../../../../utils/tenant.utils';

// ===========================================
// INVENTORY LOCATION CONTROLLERS
// ===========================================

export const listInventoryLocations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { zone, sku, productId, active } = req.query;
    const siteId = getSiteId(req);

    const warehouse = await prisma.warehouse.findFirst({
      where: warehouseWhere(siteId, {
        OR: [
          { id: parseInt(id as string) || 0 },
          { uuid: id },
          { code: id },
        ],
      }, { strict: false }),
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
};

export const getInventoryLocationById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
};

export const createInventoryLocation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const validation = CreateInventoryLocationSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
      return;
    }

    const data = validation.data;
    const siteId = requireSiteId(req);

    const warehouse = await prisma.warehouse.findFirst({
      where: warehouseWhere(siteId, {
        OR: [
          { id: parseInt(id as string) || 0 },
          { uuid: id },
          { code: id },
        ],
      }),
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
};

export const updateInventoryLocation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { warehouseId, locationId } = req.params;

    const validation = UpdateInventoryLocationSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
      return;
    }

    const data = validation.data;
    const siteId = requireSiteId(req);

    const warehouse = await prisma.warehouse.findFirst({
      where: warehouseWhere(siteId, {
        OR: [
          { id: parseInt(warehouseId as string) || 0 },
          { uuid: warehouseId },
          { code: warehouseId },
        ],
      }),
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
};

export const adjustInventory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { warehouseId, locationId } = req.params;

    const validation = AdjustInventorySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.errors });
      return;
    }

    const { quantity, reason } = validation.data;
    const siteId = requireSiteId(req);

    const warehouse = await prisma.warehouse.findFirst({
      where: warehouseWhere(siteId, {
        OR: [
          { id: parseInt(warehouseId as string) || 0 },
          { uuid: warehouseId },
          { code: warehouseId },
        ],
      }),
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
};

export const deleteInventoryLocation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { warehouseId, locationId } = req.params;
    const siteId = requireSiteId(req);

    const warehouse = await prisma.warehouse.findFirst({
      where: warehouseWhere(siteId, {
        OR: [
          { id: parseInt(warehouseId as string) || 0 },
          { uuid: warehouseId },
          { code: warehouseId },
        ],
      }),
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
};
