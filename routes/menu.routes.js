const express = require('express');
const router = express.Router();
const auth  = require('../middleware/authMiddleware');
const roles = require('../middleware/roleMiddleware');
const ctrl  = require('../controllers/menu.controller');

router.get('/categories',            auth, ctrl.getCategories);
router.post('/categories',           auth, roles('admin', 'superadmin'), ctrl.addCategory);
router.put('/categories/:id',        auth, roles('admin', 'superadmin'), ctrl.updateCategory);
router.delete('/categories/:id',     auth, roles('admin', 'superadmin'), ctrl.deleteCategory);

router.get('/items',                 auth, ctrl.getItems);
router.get('/items/:id',             auth, ctrl.getItem);
router.post('/items',                auth, roles('admin', 'superadmin'), ctrl.addItem);
router.put('/items/:id',             auth, roles('admin', 'superadmin'), ctrl.updateItem);
router.put('/items/:id/toggle',      auth, roles('admin', 'superadmin'), ctrl.toggleAvailability);
router.delete('/items/:id',          auth, roles('admin', 'superadmin'), ctrl.deleteItem);

module.exports = router;
