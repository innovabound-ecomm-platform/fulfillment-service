/**
 * Tenant utilities for fulfillment-service
 * Provides helpers for tenant-scoped database operations
 */

import type { Request } from "express";
import type { Prisma } from "@innovabound-ecomm-platform/fulfillment-db";

export function getSiteId(req: Request): string | undefined {
  return (req as { siteId?: string }).siteId;
}

export function requireSiteId(req: Request): string {
  const siteId = getSiteId(req);
  if (!siteId) {
    throw new TenantRequiredError();
  }
  return siteId;
}

interface TenantQueryOptions {
  strict?: boolean;
}

export function shipmentWhere(
  siteId: string | undefined,
  additionalWhere?: Prisma.ShipmentWhereInput,
  options: TenantQueryOptions = { strict: true }
): Prisma.ShipmentWhereInput {
  const { strict = true } = options;
  if (strict && !siteId) {
    throw new TenantRequiredError("siteId is required for this query");
  }
  const where: Prisma.ShipmentWhereInput = { ...additionalWhere };
  if (siteId) {
    where.siteId = siteId;
  }
  return where;
}

export function warehouseWhere(
  siteId: string | undefined,
  additionalWhere?: Prisma.WarehouseWhereInput,
  options: TenantQueryOptions = { strict: true }
): Prisma.WarehouseWhereInput {
  const { strict = true } = options;
  if (strict && !siteId) {
    throw new TenantRequiredError("siteId is required for this query");
  }
  const where: Prisma.WarehouseWhereInput = { ...additionalWhere };
  if (siteId) {
    where.siteId = siteId;
  }
  return where;
}

export function shippingMethodWhere(
  siteId: string | undefined,
  additionalWhere?: Prisma.ShippingMethodWhereInput,
  options: TenantQueryOptions = { strict: true }
): Prisma.ShippingMethodWhereInput {
  const { strict = true } = options;
  if (strict && !siteId) {
    throw new TenantRequiredError("siteId is required for this query");
  }
  const where: Prisma.ShippingMethodWhereInput = { ...additionalWhere };
  if (siteId) {
    where.siteId = siteId;
  }
  return where;
}

export function withSiteId<T extends Record<string, unknown>>(
  data: T,
  siteId: string | undefined
): T & { siteId: string } {
  if (!siteId) {
    throw new TenantRequiredError("siteId is required for create operations");
  }
  return { ...data, siteId };
}

export function validateTenantOwnership(
  recordSiteId: string | null | undefined,
  requestSiteId: string | undefined
): void {
  if (!requestSiteId) {
    throw new TenantRequiredError("Tenant context required");
  }
  if (!recordSiteId || recordSiteId !== requestSiteId) {
    throw new TenantRequiredError("Record does not belong to current tenant");
  }
}

export class TenantRequiredError extends Error {
  public readonly code = "TENANT_REQUIRED";
  public readonly statusCode = 403;
  constructor(message = "Tenant context is required for this operation") {
    super(message);
    this.name = "TenantRequiredError";
  }
}
