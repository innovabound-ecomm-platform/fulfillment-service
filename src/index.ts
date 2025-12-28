import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import shipmentRoutes from './routes/shipment.route';
import warehouseRoutes from './routes/warehouse.route';
import shippingMethodRoutes from './routes/shipping-method.route';
import rateRoutes from './routes/rate.route';
import fulfillmentOrderRoutes from './routes/fulfillment-order.route';

const app = express();
const PORT = process.env.PORT || 3007;

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3002", "http://localhost:3003", "http://localhost:3100"],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

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
});

export default app;
