/**
 * Shared Prisma Client
 * Used across all modules
 */

import { getFulfillmentPrisma, PrismaClient } from '@innovabound-ecomm-platform/fulfillment-db';

export const prisma: ReturnType<typeof getFulfillmentPrisma> = getFulfillmentPrisma();

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
