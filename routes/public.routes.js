const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/public.controller');

router.get('/menu/:cafe_id', ctrl.getPublicMenu);

module.exports = router;
