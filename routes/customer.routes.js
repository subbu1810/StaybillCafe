const express = require('express');
const router = express.Router();
const auth  = require('../middleware/authMiddleware');
const roles = require('../middleware/roleMiddleware');
const ctrl  = require('../controllers/customer.controller');

router.get('/',            auth, ctrl.getCustomers);
router.get('/:id',         auth, ctrl.getCustomer);
router.post('/',           auth, ctrl.addCustomer);
router.put('/:id',         auth, ctrl.updateCustomer);
router.get('/:id/orders',  auth, ctrl.getCustomerOrders);

module.exports = router;
