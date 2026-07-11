const express = require('express');
const router = express.Router();
const auth  = require('../middleware/authMiddleware');
const roles = require('../middleware/roleMiddleware');
const ctrl  = require('../controllers/bill.controller');

router.post('/',              auth, roles('cashier','admin','captain'), ctrl.generateBill);
router.get('/',               auth, ctrl.getBills);
router.get('/:id',            auth, ctrl.getBill);
router.put('/:id/discount',   auth, roles('cashier','admin','captain'), ctrl.applyDiscount);
router.put('/:id/status',     auth, roles('cashier','admin','captain'), ctrl.updateStatus);

module.exports = router;
