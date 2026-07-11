const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/auth.controller');

router.post('/register',        ctrl.register);
router.post('/register-hotel', ctrl.registerHotel);
router.post('/login',           ctrl.login);
router.get('/me',               auth, ctrl.me);
router.post('/logout',          auth, ctrl.logout);
router.put('/change-password',  auth, ctrl.changePassword);

module.exports = router;
