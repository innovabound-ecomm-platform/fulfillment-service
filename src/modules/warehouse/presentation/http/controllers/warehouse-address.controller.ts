import type { Response } from 'express';
import { prisma } from '../../../../../common/utils/db';
import type { AuthenticatedRequest } from '../../../../../common/http/auth.middleware';
import {
  CreateWarehouseAddressSchema,
  UpdateWarehouseAddressSchema,
} from '../schemas/warehouse.schema';
import { getSiteId, requireSiteId, warehouseWhere } from '../../../../../utils/tenant.utils';

// ===========================================
// WAREHOUSE ADDRESS CONTROLLERS
// ===========================================

export const listWarehouseAddresses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
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
};

export const createWarehouseAddress = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const validation = CreateWarehouseAddressSchema.safeParse(req.body);
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
};

export const updateWarehouseAddress = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { warehouseId, addressId } = req.params;

    const validation = UpdateWarehouseAddressSchema.safeParse(req.body);
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
};

export const deleteWarehouseAddress = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { warehouseId, addressId } = req.params;
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
};
