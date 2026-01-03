import { z } from 'zod';

// ===========================================
// ENUMS
// ===========================================

export const WarehouseStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'MAINTENANCE',
]);

// ===========================================
// WAREHOUSE SCHEMAS
// ===========================================

export const CreateWarehouseSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  status: WarehouseStatusSchema.optional().default('ACTIVE'),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  cutoffTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), // HH:MM format
  timezone: z.string().optional().default('America/Chicago'),
  processingDays: z.number().int().positive().optional().default(1),
});

export const UpdateWarehouseSchema = CreateWarehouseSchema.partial().omit({ code: true });

export const CreateWarehouseAddressSchema = z.object({
  type: z.enum(['ship_from', 'return']).optional().default('ship_from'),
  isDefault: z.boolean().optional().default(false),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().min(1),
  country: z.string().length(2).default('US'),
  phone: z.string().optional(),
});

export const UpdateWarehouseAddressSchema = CreateWarehouseAddressSchema.partial();

// ===========================================
// INVENTORY LOCATION SCHEMAS
// ===========================================

export const CreateInventoryLocationSchema = z.object({
  locationCode: z.string().min(1).max(50),
  zone: z.string().optional(),
  productId: z.string().optional(),
  variantId: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().int().nonnegative().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const UpdateInventoryLocationSchema = z.object({
  zone: z.string().optional(),
  productId: z.string().optional(),
  variantId: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export const AdjustInventorySchema = z.object({
  quantity: z.number().int(),
  reason: z.string().optional(),
});

// ===========================================
// QUERY SCHEMAS
// ===========================================

export const WarehouseListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: WarehouseStatusSchema.optional(),
});

// ===========================================
// TYPE EXPORTS
// ===========================================

export type CreateWarehouse = z.infer<typeof CreateWarehouseSchema>;
export type UpdateWarehouse = z.infer<typeof UpdateWarehouseSchema>;
export type CreateWarehouseAddress = z.infer<typeof CreateWarehouseAddressSchema>;
export type UpdateWarehouseAddress = z.infer<typeof UpdateWarehouseAddressSchema>;
export type CreateInventoryLocation = z.infer<typeof CreateInventoryLocationSchema>;
export type UpdateInventoryLocation = z.infer<typeof UpdateInventoryLocationSchema>;
export type AdjustInventory = z.infer<typeof AdjustInventorySchema>;
export type WarehouseListQuery = z.infer<typeof WarehouseListQuerySchema>;
