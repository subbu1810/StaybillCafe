const express = require('express');
const router = express.Router();
const auth  = require('../middleware/authMiddleware');
const roles = require('../middleware/roleMiddleware');
const ctrl  = require('../controllers/order.controller');

router.post('/',                      auth, roles('admin', 'captain', 'cashier'), ctrl.createOrder);
router.get('/running',                auth, ctrl.getRunningOrders);
router.get('/:id',                    auth, ctrl.getOrder);
router.post('/:id/items',             auth, roles('admin', 'captain', 'cashier'), ctrl.addItems);
router.put('/:id/items/:itemId',      auth, roles('admin', 'captain', 'cashier'), ctrl.updateItem);
router.delete('/:id/items/:itemId',   auth, roles('admin', 'captain', 'cashier'), ctrl.removeItem);
router.put('/:id/status',             auth, ctrl.updateStatus);

module.exports = router;
