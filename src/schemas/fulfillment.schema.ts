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

export const WarehouseStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'MAINTENANCE',
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
// SHIPPING METHOD SCHEMAS
// ===========================================

export const CreateShippingMethodSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  carrier: CarrierCodeSchema.optional(),
  carrierServiceCode: z.string().optional(),
  baseCost: z.number().int().nonnegative(),
  costPerOz: z.number().int().nonnegative().optional(),
  freeShippingMin: z.number().int().positive().optional(),
  minDays: z.number().int().nonnegative(),
  maxDays: z.number().int().nonnegative(),
  isActive: z.boolean().optional().default(true),
  maxWeight: z.number().int().positive().optional(),
  countriesAllowed: z.array(z.string()).optional(),
  countriesBlocked: z.array(z.string()).optional(),
  sortOrder: z.number().int().nonnegative().optional().default(0),
});

export const UpdateShippingMethodSchema = CreateShippingMethodSchema.partial().omit({ code: true });

// ===========================================
// SHIPPING RATE SCHEMAS
// ===========================================

export const CreateShippingRateSchema = z.object({
  originCountry: z.string().length(2),
  originRegion: z.string().optional(),
  destCountry: z.string().length(2),
  destRegion: z.string().optional(),
  shippingMethodId: z.number().int().positive(),
  minWeight: z.number().int().nonnegative().optional().default(0),
  maxWeight: z.number().int().positive(),
  rate: z.number().int().nonnegative(),
  isActive: z.boolean().optional().default(true),
});

export const UpdateShippingRateSchema = CreateShippingRateSchema.partial();

export const CalculateRatesSchema = z.object({
  originCountry: z.string().length(2).default('US'),
  originPostalCode: z.string().optional(),
  destCountry: z.string().length(2),
  destPostalCode: z.string().min(1),
  destState: z.string().optional(),
  weightOz: z.number().int().positive(),
  cartTotal: z.number().int().nonnegative().optional(),
});

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

export const WarehouseListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: WarehouseStatusSchema.optional(),
});

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

export type CreateShipment = z.infer<typeof CreateShipmentSchema>;
export type UpdateShipment = z.infer<typeof UpdateShipmentSchema>;
export type AddShipmentItem = z.infer<typeof AddShipmentItemSchema>;
export type GenerateLabel = z.infer<typeof GenerateLabelSchema>;
export type MarkShipped = z.infer<typeof MarkShippedSchema>;
export type AddTrackingEvent = z.infer<typeof AddTrackingEventSchema>;
export type CreateWarehouse = z.infer<typeof CreateWarehouseSchema>;
export type UpdateWarehouse = z.infer<typeof UpdateWarehouseSchema>;
export type CreateWarehouseAddress = z.infer<typeof CreateWarehouseAddressSchema>;
export type UpdateWarehouseAddress = z.infer<typeof UpdateWarehouseAddressSchema>;
export type CreateInventoryLocation = z.infer<typeof CreateInventoryLocationSchema>;
export type UpdateInventoryLocation = z.infer<typeof UpdateInventoryLocationSchema>;
export type AdjustInventory = z.infer<typeof AdjustInventorySchema>;
export type CreateShippingMethod = z.infer<typeof CreateShippingMethodSchema>;
export type UpdateShippingMethod = z.infer<typeof UpdateShippingMethodSchema>;
export type CreateShippingRate = z.infer<typeof CreateShippingRateSchema>;
export type UpdateShippingRate = z.infer<typeof UpdateShippingRateSchema>;
export type CalculateRates = z.infer<typeof CalculateRatesSchema>;
export type CreateFulfillmentOrder = z.infer<typeof CreateFulfillmentOrderSchema>;
export type AssignFulfillmentOrder = z.infer<typeof AssignFulfillmentOrderSchema>;
export type PickItem = z.infer<typeof PickItemSchema>;
export type ShipmentListQuery = z.infer<typeof ShipmentListQuerySchema>;
export type WarehouseListQuery = z.infer<typeof WarehouseListQuerySchema>;
export type FulfillmentOrderListQuery = z.infer<typeof FulfillmentOrderListQuerySchema>;
