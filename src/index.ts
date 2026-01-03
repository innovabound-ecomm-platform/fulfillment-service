import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import shipmentRoutes from './routes/shipment.route';
import warehouseRoutes from './routes/warehouse.route';
import shippingMethodRoutes from './routes/shipping-method.route';
import rateRoutes from './routes/rate.route';
import fulfillmentOrderRoutes from './routes/fulfillment-order.route';

const app: Application = express();
const PORT = process.env.PORT || 3007;

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3002", "http://localhost:3003", "http://localhost:3100"],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Swagger/OpenAPI configuration
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Fulfillment Service API',
      version: '1.0.0',
      description: 'Fulfillment and shipping management service for the e-commerce platform. Handles shipments, tracking, carriers, fulfillment centers, and delivery options.',
      contact: {
        name: 'API Support',
        email: 'support@innovabound.com',
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC',
      },
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
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
  apis: ['./src/routes/*.ts', './src/routes/*.route.ts'],
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'fulfillment-service' });
});

// Routes
app.use('/shipments', shipmentRoutes);
app.use('/warehouses', warehouseRoutes);
app.use('/shipping-methods', shippingMethodRoutes);
app.use('/rates', rateRoutes);
app.use('/fulfillment-orders', fulfillmentOrderRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Fulfillment service running on port ${PORT}`);
  console.log(`API Documentation:`);
  console.log(`  - Swagger UI: http://localhost:${PORT}/api-docs`);
  console.log(`  - OpenAPI JSON: http://localhost:${PORT}/api-docs.json`);
  console.log(`  - ReDoc: http://localhost:${PORT}/redoc`);
});

export default app;
