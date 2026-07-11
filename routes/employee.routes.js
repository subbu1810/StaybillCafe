const express = require('express');
const router = express.Router();
const auth  = require('../middleware/authMiddleware');
const roles = require('../middleware/roleMiddleware');
const ctrl  = require('../controllers/employee.controller');

router.get('/',      auth, roles('admin', 'superadmin'), ctrl.getAll);
router.get('/:id',   auth, roles('admin', 'superadmin'), ctrl.getOne);
router.post('/',     auth, roles('admin', 'superadmin'), ctrl.create);
router.put('/:id',   auth, roles('admin', 'superadmin'), ctrl.update);
router.delete('/:id',auth, roles('admin', 'superadmin'), ctrl.remove);

module.exports = router;
