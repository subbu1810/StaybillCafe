const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const roles   = require('../middleware/roleMiddleware');
const ctrl    = require('../controllers/superadmin.controller');

// All super admin routes require valid JWT + superadmin role
router.use(auth, roles('superadmin'));

router.get('/stats',                  ctrl.globalStats);
router.get('/cafes',                  ctrl.listCafes);
router.post('/cafes',                 ctrl.createCafe);
router.get('/cafes/:id',               ctrl.getCafe);
router.put('/cafes/:id',              ctrl.updateCafe);
router.delete('/cafes/:id',           ctrl.deactivateCafe);
router.post('/cafes/:id/admin',       ctrl.createCafeAdmin);
router.get('/cafes/:id/stats',        ctrl.getCafeStats);
router.get('/cafes/:id/users',         ctrl.getCafeUsers);
router.get('/cafes/:id/sales-chart',   ctrl.getCafeSalesChart);
router.put('/users/:id/deactivate',    ctrl.deactivateUser);
router.put('/users/:id/password',      ctrl.updateUserPassword);

module.exports = router;
