# Fulfillment Service

Fulfillment and shipping management service for the e-commerce platform. Handles warehouse operations, shipment creation, tracking, and delivery management.

## Features

- **Shipments**: Create and manage shipments with carrier integration
- **Tracking**: Real-time tracking events and delivery updates
- **Warehouses**: Multi-warehouse fulfillment center management
- **Inventory Locations**: Bin/slot-level inventory tracking within warehouses
- **Shipping Methods**: Configurable shipping options with rate calculation
- **Fulfillment Orders**: Internal pick/pack work orders
- **Rate Shopping**: Calculate shipping rates across carriers

## Architecture

This service follows the microservices architecture pattern:
- Uses `@innovabound-ecomm-platform/fulfillment-db` for database operations
- Publishes events via `@innovabound-ecomm-platform/kafka-client`
- Integrates with carrier APIs for labels and tracking

## Shipment Status Flow

```
PENDING → PROCESSING → READY_TO_SHIP → SHIPPED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
                                                      ↓                    ↓
                                                 EXCEPTION        FAILED_ATTEMPT
                                                      ↓
                                              RETURNED_TO_SENDER
```

## API Endpoints

### Shipments
- `GET /shipments` - List shipments
- `GET /shipments/:id` - Get shipment details
- `POST /shipments` - Create shipment
- `PUT /shipments/:id` - Update shipment
- `POST /shipments/:id/label` - Generate shipping label
- `POST /shipments/:id/ship` - Mark as shipped
- `POST /shipments/:id/cancel` - Cancel shipment
- `GET /shipments/:id/tracking` - Get tracking events
- `POST /shipments/:id/tracking` - Add tracking event

### Shipment Items
- `GET /shipments/:id/items` - List items in shipment
- `POST /shipments/:id/items` - Add item to shipment
- `DELETE /shipments/:shipmentId/items/:itemId` - Remove item

### Warehouses
- `GET /warehouses` - List warehouses
- `GET /warehouses/:id` - Get warehouse details
- `POST /warehouses` - Create warehouse (admin)
- `PUT /warehouses/:id` - Update warehouse (admin)
- `DELETE /warehouses/:id` - Delete warehouse (admin)

### Warehouse Addresses
- `GET /warehouses/:id/addresses` - List warehouse addresses
- `POST /warehouses/:id/addresses` - Add address
- `PUT /warehouses/:warehouseId/addresses/:addressId` - Update address
- `DELETE /warehouses/:warehouseId/addresses/:addressId` - Remove address

### Inventory Locations
- `GET /warehouses/:id/locations` - List inventory locations
- `GET /warehouses/:warehouseId/locations/:locationId` - Get location
- `POST /warehouses/:id/locations` - Create location
- `PUT /warehouses/:warehouseId/locations/:locationId` - Update location
- `DELETE /warehouses/:warehouseId/locations/:locationId` - Delete location

### Shipping Methods
- `GET /shipping-methods` - List shipping methods
- `GET /shipping-methods/:id` - Get method details
- `POST /shipping-methods` - Create method (admin)
- `PUT /shipping-methods/:id` - Update method (admin)
- `DELETE /shipping-methods/:id` - Delete method (admin)

### Shipping Rates
- `POST /rates/calculate` - Calculate shipping rates
- `GET /rates` - List shipping rates (admin)
- `POST /rates` - Create rate (admin)
- `PUT /rates/:id` - Update rate (admin)

### Fulfillment Orders
- `GET /fulfillment-orders` - List fulfillment orders
- `GET /fulfillment-orders/:id` - Get fulfillment order
- `POST /fulfillment-orders` - Create fulfillment order
- `POST /fulfillment-orders/:id/assign` - Assign to worker
- `POST /fulfillment-orders/:id/start` - Start picking
- `POST /fulfillment-orders/:id/complete` - Complete order
- `POST /fulfillment-orders/:id/items/:itemId/pick` - Pick item

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `3011` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `KAFKA_BROKERS` | Kafka broker addresses | - |
| `SHIPPO_API_KEY` | Shippo API key (optional) | - |
| `EASYPOST_API_KEY` | EasyPost API key (optional) | - |

## Events Published

- `shipment.created` - When a shipment is created
- `shipment.label_created` - When shipping label is generated
- `shipment.shipped` - When shipment is handed to carrier
- `shipment.tracking_update` - When tracking status changes
- `shipment.delivered` - When shipment is delivered
- `shipment.exception` - When delivery exception occurs
- `fulfillment.order_created` - When fulfillment order is created
- `fulfillment.order_completed` - When picking is complete

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint
```

## Docker

```bash
# Build image
docker build -t fulfillment-service .

# Run container
docker run -p 3011:3011 fulfillment-service
```
