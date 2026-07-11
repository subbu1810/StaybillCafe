const express = require('express');
const router = express.Router();
const { 
    getInventory, 
    addInventoryItem, 
    updateInventoryItem, 
    deleteInventoryItem,
    getMenuItemIngredients,
    setMenuItemIngredients 
} = require('../controllers/inventory.controller');
const authMiddleware = require('../middleware/authMiddleware');
const roles = require('../middleware/roleMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);
router.use(roles('superadmin', 'admin'));

// Inventory CRUD
router.get('/', getInventory);
router.post('/', addInventoryItem);
router.put('/:id', updateInventoryItem);
router.delete('/:id', deleteInventoryItem);

// Recipe Management
router.get('/recipes/:menu_item_id', getMenuItemIngredients);
router.post('/recipes/:menu_item_id', setMenuItemIngredients);

module.exports = router;
