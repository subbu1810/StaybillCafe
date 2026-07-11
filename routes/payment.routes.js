const express = require('express');
const router = express.Router();
const auth  = require('../middleware/authMiddleware');
const roles = require('../middleware/roleMiddleware');
const ctrl  = require('../controllers/payment.controller');

router.post('/',             auth, roles('cashier','admin','captain'), ctrl.recordPayment);
router.get('/today',         auth, ctrl.getTodayPayments);
router.get('/bill/:billId',  auth, ctrl.getPaymentByBill);

module.exports = router;
