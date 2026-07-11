const express = require('express');
const router = express.Router();
const auth  = require('../middleware/authMiddleware');
const roles = require('../middleware/roleMiddleware');
const ctrl  = require('../controllers/table.controller');

// ── Section routes (must be before /:id to avoid conflicts) ──────
router.get('/sections',        auth, ctrl.getSections);
router.post('/sections',       auth, roles('admin', 'superadmin'), ctrl.addSection);
router.put('/sections/:id',    auth, roles('admin', 'superadmin'), ctrl.updateSection);
router.delete('/sections/:id', auth, roles('admin', 'superadmin'), ctrl.deleteSection);

// ── Table routes ─────────────────────────────────────────────────
router.get('/',              auth, ctrl.getTables);
router.get('/:id',           auth, ctrl.getTable);
router.put('/:id/status',    auth, roles('admin','captain','cashier'), ctrl.updateStatus);
router.post('/',             auth, roles('admin', 'superadmin'), ctrl.addTable);
router.put('/:id',           auth, roles('admin', 'superadmin'), ctrl.updateTable);
router.delete('/:id',        auth, roles('admin', 'superadmin'), ctrl.deleteTable);

module.exports = router;
