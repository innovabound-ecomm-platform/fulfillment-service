import { z } from 'zod';

// ===========================================
// ENUMS
// ===========================================

export const FulfillmentPrioritySchema = z.enum([
  'STANDARD',
  'EXPRESS',
  'SAME_DAY',
  'NEXT_DAY',
]);

// ===========================================
// FULFILLMENT ORDER SCHEMAS
// ===========================================

export const CreateFulfillmentOrderSchema = z.object({
  orderId: z.string().min(1),
  warehouseId: z.number().int().positive(),
  priority: FulfillmentPrioritySchema.optional().default('STANDARD'),
  items: z.array(z.object({
    orderItemId: z.string().min(1),
    productId: z.string().min(1),
    variantId: z.string().optional(),
    sku: z.string().optional(),
    quantityRequested: z.number().int().positive(),
  })).min(1),
});

export const AssignFulfillmentOrderSchema = z.object({
  assignedTo: z.string().min(1),
});

export const PickItemSchema = z.object({
  quantityPicked: z.number().int().nonnegative(),
  pickedFromLocation: z.string().optional(),
});

// ===========================================
// QUERY SCHEMAS
// ===========================================

export const FulfillmentOrderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
  orderId: z.string().optional(),
  assignedTo: z.string().optional(),
  priority: FulfillmentPrioritySchema.optional(),
});

// ===========================================
// TYPE EXPORTS
// ===========================================

export type CreateFulfillmentOrder = z.infer<typeof CreateFulfillmentOrderSchema>;
export type AssignFulfillmentOrder = z.infer<typeof AssignFulfillmentOrderSchema>;
export type PickItem = z.infer<typeof PickItemSchema>;
export type FulfillmentOrderListQuery = z.infer<typeof FulfillmentOrderListQuerySchema>;
