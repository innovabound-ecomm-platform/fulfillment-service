import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../../../common/http/auth.middleware';
import * as warehouseController from '../controllers/warehouse.controller';

const router: Router = Router();

// ===========================================
// WAREHOUSE ROUTES
// ===========================================

/**
 * @openapi
 * /warehouses:
 *   get:
 *     summary: List warehouses
 *     description: Retrieve a paginated list of warehouses with optional filtering
 *     tags:
 *       - Warehouses
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, MAINTENANCE]
 *         description: Filter by warehouse status
 *     responses:
 *       200:
 *         description: List of warehouses
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/', requireAuth, warehouseController.listWarehouses);

/**
 * @openapi
 * /warehouses/{id}:
 *   get:
 *     summary: Get warehouse by ID
 *     description: Returns warehouse details by ID, UUID, or code
 *     tags:
 *       - Warehouses
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Warehouse ID, UUID, or code
 *     responses:
 *       200:
 *         description: Warehouse details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Warehouse not found
 */
router.get('/:id', requireAuth, warehouseController.getWarehouseById);

/**
 * @openapi
 * /warehouses:
 *   post:
 *     summary: Create a warehouse
 *     description: Create a new warehouse (admin/fulfillment only)
 *     tags:
 *       - Warehouses
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - name
 *             properties:
 *               code:
 *                 type: string
 *                 description: Unique warehouse code
 *               name:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, MAINTENANCE]
 *               contactName:
 *                 type: string
 *               contactEmail:
 *                 type: string
 *               contactPhone:
 *                 type: string
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               cutoffTime:
 *                 type: string
 *               timezone:
 *                 type: string
 *               processingDays:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Warehouse created successfully
 *       400:
 *         description: Validation error or duplicate code
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/', requireAuth, requirePermission('admin', 'fulfillment:manage'), warehouseController.createWarehouse);

/**
 * @openapi
 * /warehouses/{id}:
 *   put:
 *     summary: Update a warehouse
 *     description: Update warehouse details (admin/fulfillment only)
 *     tags:
 *       - Warehouses
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Warehouse ID, UUID, or code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               status:
 *                 type: string
 *               contactName:
 *                 type: string
 *               contactEmail:
 *                 type: string
 *     responses:
 *       200:
 *         description: Warehouse updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Warehouse not found
 */
router.put('/:id', requireAuth, requirePermission('admin', 'fulfillment:manage'), warehouseController.updateWarehouse);

/**
 * @openapi
 * /warehouses/{id}:
 *   delete:
 *     summary: Delete a warehouse
 *     description: Delete a warehouse (admin only, must have no active shipments)
 *     tags:
 *       - Warehouses
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Warehouse ID, UUID, or code
 *     responses:
 *       200:
 *         description: Warehouse deleted successfully
 *       400:
 *         description: Cannot delete warehouse with active shipments
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Warehouse not found
 */
router.delete('/:id', requireAuth, requirePermission('admin'), warehouseController.deleteWarehouse);

// ===========================================
// WAREHOUSE ADDRESS ROUTES
// ===========================================

/**
 * @openapi
 * /warehouses/{id}/addresses:
 *   get:
 *     summary: List warehouse addresses
 *     description: Get all addresses for a warehouse
 *     tags:
 *       - Warehouses
 *       - Addresses
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Warehouse ID, UUID, or code
 *     responses:
 *       200:
 *         description: List of warehouse addresses
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Warehouse not found
 */
router.get('/:id/addresses', requireAuth, warehouseController.listWarehouseAddresses);

router.post(
  '/:id/addresses',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  warehouseController.createWarehouseAddress
);

router.put(
  '/:warehouseId/addresses/:addressId',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  warehouseController.updateWarehouseAddress
);

router.delete(
  '/:warehouseId/addresses/:addressId',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  warehouseController.deleteWarehouseAddress
);

// ===========================================
// INVENTORY LOCATION ROUTES
// ===========================================

router.get('/:id/locations', requireAuth, warehouseController.listInventoryLocations);

router.get('/:warehouseId/locations/:locationId', requireAuth, warehouseController.getInventoryLocationById);

router.post(
  '/:id/locations',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage', 'warehouse'),
  warehouseController.createInventoryLocation
);

router.put(
  '/:warehouseId/locations/:locationId',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage', 'warehouse'),
  warehouseController.updateInventoryLocation
);

router.post(
  '/:warehouseId/locations/:locationId/adjust',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage', 'warehouse'),
  warehouseController.adjustInventory
);

router.delete(
  '/:warehouseId/locations/:locationId',
  requireAuth,
  requirePermission('admin', 'fulfillment:manage'),
  warehouseController.deleteInventoryLocation
);

export default router;
