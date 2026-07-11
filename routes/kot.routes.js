const express = require('express');
const router = express.Router();
const auth  = require('../middleware/authMiddleware');
const roles = require('../middleware/roleMiddleware');
const ctrl  = require('../controllers/kot.controller');

router.post('/',             auth, roles('admin', 'captain', 'cashier'), ctrl.sendKOT);
router.get('/',              auth, ctrl.getKOTs);
router.get('/:id',           auth, ctrl.getKOT);
router.put('/:id/status',    auth, roles('kitchen','admin'), ctrl.updateStatus);
router.put('/:id/priority',  auth, roles('admin','captain'), ctrl.updatePriority);

module.exports = router;
