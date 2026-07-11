const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/create-order', subscriptionController.createOrder);
router.post('/verify', subscriptionController.verifyPayment);

module.exports = router;
