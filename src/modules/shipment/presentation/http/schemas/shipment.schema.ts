import { z } from 'zod';

// ===========================================
// ENUMS
// ===========================================

export const ShipmentStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'READY_TO_SHIP',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED_ATTEMPT',
  'RETURNED_TO_SENDER',
  'EXCEPTION',
  'CANCELLED',
]);

export const FulfillmentPrioritySchema = z.enum([
  'STANDARD',
  'EXPRESS',
  'SAME_DAY',
  'NEXT_DAY',
]);

export const CarrierCodeSchema = z.enum([
  'USPS',
  'UPS',
  'FEDEX',
  'DHL',
  'AMAZON',
  'ONTRAC',
  'LASERSHIP',
  'OTHER',
]);

export const TrackingEventTypeSchema = z.enum([
  'LABEL_CREATED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERY_ATTEMPTED',
  'DELIVERED',
  'EXCEPTION',
  'RETURNED',
  'OTHER',
]);

// ===========================================
// SHIPMENT SCHEMAS
// ===========================================

export const CreateShipmentSchema = z.object({
  orderId: z.string().min(1),
  priority: FulfillmentPrioritySchema.optional().default('STANDARD'),
  carrier: CarrierCodeSchema.optional(),
  carrierName: z.string().optional(),
  serviceLevel: z.string().optional(),
  serviceLevelCode: z.string().optional(),
  warehouseId: z.number().int().positive().optional(),
  
  // Destination
  shipToName: z.string().min(1),
  shipToCompany: z.string().optional(),
  shipToAddressLine1: z.string().min(1),
  shipToAddressLine2: z.string().optional(),
  shipToCity: z.string().min(1),
  shipToState: z.string().optional(),
  shipToPostalCode: z.string().min(1),
  shipToCountry: z.string().length(2).default('US'),
  shipToPhone: z.string().optional(),
  
  // Package
  weightOz: z.number().int().positive().optional(),
  lengthIn: z.number().positive().optional(),
  widthIn: z.number().positive().optional(),
  heightIn: z.number().positive().optional(),
  
  // Options
  requiresSignature: z.boolean().optional().default(false),
  insuranceAmount: z.number().int().nonnegative().optional(),
  
  // Items
  items: z.array(z.object({
    orderItemId: z.string().min(1),
    productId: z.string().min(1),
    variantId: z.string().optional(),
    sku: z.string().optional(),
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    weightOz: z.number().int().positive().optional(),
    serialNumbers: z.array(z.string()).optional(),
    lotNumber: z.string().optional(),
  })).optional(),
});

export const UpdateShipmentSchema = z.object({
  priority: FulfillmentPrioritySchema.optional(),
  carrier: CarrierCodeSchema.optional(),
  carrierName: z.string().optional(),
  serviceLevel: z.string().optional(),
  serviceLevelCode: z.string().optional(),
  warehouseId: z.number().int().positive().optional(),
  weightOz: z.number().int().positive().optional(),
  lengthIn: z.number().positive().optional(),
  widthIn: z.number().positive().optional(),
  heightIn: z.number().positive().optional(),
  requiresSignature: z.boolean().optional(),
  insuranceAmount: z.number().int().nonnegative().optional(),
  estimatedDeliveryDate: z.coerce.date().optional(),
});

export const AddShipmentItemSchema = z.object({
  orderItemId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().optional(),
  sku: z.string().optional(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  weightOz: z.number().int().positive().optional(),
  serialNumbers: z.array(z.string()).optional(),
  lotNumber: z.string().optional(),
});

export const GenerateLabelSchema = z.object({
  carrier: CarrierCodeSchema,
  serviceLevel: z.string().min(1),
  labelFormat: z.enum(['PDF', 'ZPL', 'PNG']).optional().default('PDF'),
});

export const MarkShippedSchema = z.object({
  trackingNumber: z.string().min(1),
  trackingUrl: z.string().url().optional(),
  carrier: CarrierCodeSchema.optional(),
  shippingCost: z.number().int().nonnegative().optional(),
});

export const AddTrackingEventSchema = z.object({
  eventType: TrackingEventTypeSchema,
  eventCode: z.string().optional(),
  eventDescription: z.string().min(1),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  occurredAt: z.coerce.date().optional(),
});

// ===========================================
// QUERY SCHEMAS
// ===========================================

export const ShipmentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: ShipmentStatusSchema.optional(),
  orderId: z.string().optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
  carrier: CarrierCodeSchema.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'status', 'shippedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ===========================================
// TYPE EXPORTS
// ===========================================

export type CreateShipment = z.infer<typeof CreateShipmentSchema>;
export type UpdateShipment = z.infer<typeof UpdateShipmentSchema>;
export type AddShipmentItem = z.infer<typeof AddShipmentItemSchema>;
export type GenerateLabel = z.infer<typeof GenerateLabelSchema>;
export type MarkShipped = z.infer<typeof MarkShippedSchema>;
export type AddTrackingEvent = z.infer<typeof AddTrackingEventSchema>;
export type ShipmentListQuery = z.infer<typeof ShipmentListQuerySchema>;
