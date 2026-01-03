/**
 * Application Configuration
 * Loads and validates environment variables
 */

export const config = {
  app: {
    port: parseInt(process.env.PORT || '3007', 10),
    env: process.env.NODE_ENV || 'development',
    serviceName: 'fulfillment-service',
  },
  
  cors: {
    origins: [
      'http://localhost:3000',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3100',
    ],
    credentials: true,
  },

  auth: {
    serviceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:8003',
    issuer: 'auth-service',
    audience: 'ecomm-platform',
  },

  database: {
    url: process.env.DATABASE_URL || '',
  },

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: 'fulfillment-service',
    groupId: 'fulfillment-service-group',
  },

  api: {
    title: 'Fulfillment Service API',
    version: '1.0.0',
    description: 'Fulfillment and shipping management service for the e-commerce platform',
  },
} as const;

export type Config = typeof config;
export default config;
