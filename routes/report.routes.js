const express = require('express');
const router = express.Router();
const auth  = require('../middleware/authMiddleware');
const roles = require('../middleware/roleMiddleware');
const ctrl  = require('../controllers/report.controller');

router.get('/summary',          auth, roles('admin', 'superadmin'), ctrl.getSummary);
router.get('/sales',            auth, roles('admin', 'superadmin'), ctrl.getSalesTrend);
router.get('/top-items',        auth, roles('admin', 'superadmin'), ctrl.getTopItems);
router.get('/payment-breakup',  auth, roles('admin', 'superadmin'), ctrl.getPaymentBreakup);
router.get('/category-sales',   auth, roles('admin', 'superadmin'), ctrl.getCategorySales);
router.get('/hourly',           auth, roles('admin', 'superadmin'), ctrl.getHourlySales);
router.get('/export',           auth, roles('admin', 'superadmin'), ctrl.getExportData);

module.exports = router;
