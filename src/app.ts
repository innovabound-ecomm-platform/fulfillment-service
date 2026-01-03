/**
 * Express application setup
 */

import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import config from './config';

// Import module routes
import warehouseRoutes from './modules/warehouse/presentation/http/routes/warehouse.route';
import shipmentRoutes from './routes/shipment.route';
import shippingMethodRoutes from './routes/shipping-method.route';
import rateRoutes from './routes/rate.route';
import fulfillmentOrderRoutes from './routes/fulfillment-order.route';
import trackingRoutes from './routes/tracking.route';
import shipmentItemRoutes from './routes/shipment-item.route';

// Database client for health checks
import { prisma } from './common/utils/db';

export function createApp(): Application {
  const app = express();

  // Middleware
  app.use(cors({
    origin: [...config.cors.origins],
    credentials: config.cors.credentials,
  }));
  app.use(express.json());
  app.use(cookieParser());

  // Swagger/OpenAPI configuration
  const swaggerOptions: swaggerJsdoc.Options = {
    definition: {
      openapi: '3.0.3',
      info: config.api,
      servers: [
        {
          url: `http://localhost:${config.app.port}`,
          description: 'Development server',
        },
      ],
      tags: [
        {
          name: 'Shipments',
          description: 'Shipment management and tracking operations',
        },
        {
          name: 'Warehouses',
          description: 'Fulfillment center and warehouse management',
        },
        {
          name: 'Shipping Methods',
          description: 'Carrier and shipping method configuration',
        },
        {
          name: 'Rates',
          description: 'Shipping rate calculations and quotes',
        },
        {
          name: 'Fulfillment Orders',
          description: 'Fulfillment order processing and management',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'access_token',
          },
        },
      },
    },
    apis: [
      './src/routes/*.ts',
      './src/routes/*.route.ts',
      './src/modules/*/presentation/http/routes/*.ts',
      './src/modules/*/presentation/http/routes/*.route.ts',
    ],
  };

  const swaggerSpec = swaggerJsdoc(swaggerOptions);

  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Fulfillment Service API Docs',
  }));

  // OpenAPI JSON spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // ReDoc documentation
  app.get('/redoc', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fulfillment Service API - ReDoc</title>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
          <style>
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          <redoc spec-url='/api-docs.json'></redoc>
          <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
        </body>
      </html>
    `);
  });

  // Health check - liveness
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: config.app.serviceName });
  });

  // Health check - readiness (with database check)
  app.get('/health/ready', async (req, res) => {
    try {
      // Check database connectivity
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: 'ok',
        service: config.app.serviceName,
        checks: {
          database: 'ok',
        },
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: 'error',
        service: config.app.serviceName,
        checks: {
          database: 'error',
        },
      });
    }
  });

  // Routes
  app.use('/warehouses', warehouseRoutes);
  app.use('/shipments', shipmentRoutes);
  app.use('/shipping-methods', shippingMethodRoutes);
  app.use('/rates', rateRoutes);
  app.use('/fulfillment-orders', fulfillmentOrderRoutes);
  app.use('/tracking', trackingRoutes);
  app.use('/shipment-items', shipmentItemRoutes);

  // Error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
