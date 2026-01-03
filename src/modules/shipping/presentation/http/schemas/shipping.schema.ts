import { z } from 'zod';

// ===========================================
// ENUMS
// ===========================================

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
// TYPE EXPORTS
// ===========================================

export type CreateShippingMethod = z.infer<typeof CreateShippingMethodSchema>;
export type UpdateShippingMethod = z.infer<typeof UpdateShippingMethodSchema>;
export type CreateShippingRate = z.infer<typeof CreateShippingRateSchema>;
export type UpdateShippingRate = z.infer<typeof UpdateShippingRateSchema>;
export type CalculateRates = z.infer<typeof CalculateRatesSchema>;
