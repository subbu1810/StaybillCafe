const db = require('../config/db');

// Get all inventory items
const getInventory = async (req, res) => {
    try {
        const { cafe_id } = req.user;
        const [items] = await db.query(
            'SELECT * FROM inventory WHERE cafe_id = ? ORDER BY name ASC',
            [cafe_id]
        );
        res.json({ success: true, items });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Add new inventory item
const addInventoryItem = async (req, res) => {
    try {
        const { cafe_id } = req.user;
        const { name, unit, quantity, min_quantity, cost_per_unit, category } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }

        const [result] = await db.query(
            `INSERT INTO inventory (cafe_id, name, unit, quantity, min_quantity, cost_per_unit, category)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [cafe_id, name, unit, quantity || 0, min_quantity || 0, cost_per_unit || 0, category || null]
        );

        res.status(201).json({ success: true, message: 'Item added successfully', id: result.insertId });
    } catch (error) {
        console.error('Error adding inventory item:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Update inventory item
const updateInventoryItem = async (req, res) => {
    try {
        const { cafe_id } = req.user;
        const { id } = req.params;
        const { name, unit, quantity, min_quantity, cost_per_unit, category } = req.body;

        // Verify ownership
        const [existing] = await db.query('SELECT id FROM inventory WHERE id = ? AND cafe_id = ?', [id, cafe_id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        await db.query(
            `UPDATE inventory 
             SET name = ?, unit = ?, quantity = ?, min_quantity = ?, cost_per_unit = ?, category = ?
             WHERE id = ? AND cafe_id = ?`,
            [name, unit, quantity, min_quantity, cost_per_unit, category, id, cafe_id]
        );

        res.json({ success: true, message: 'Item updated successfully' });
    } catch (error) {
        console.error('Error updating inventory item:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Delete inventory item
const deleteInventoryItem = async (req, res) => {
    try {
        const { cafe_id } = req.user;
        const { id } = req.params;

        // Verify ownership
        const [existing] = await db.query('SELECT id FROM inventory WHERE id = ? AND cafe_id = ?', [id, cafe_id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        await db.query('DELETE FROM inventory WHERE id = ? AND cafe_id = ?', [id, cafe_id]);
        res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error deleting inventory item:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// === Recipe Management ===

// Get ingredients for a menu item
const getMenuItemIngredients = async (req, res) => {
    try {
        const { cafe_id } = req.user;
        const { menu_item_id } = req.params;

        // Verify menu item belongs to cafe
        const [menuItem] = await db.query('SELECT id FROM menu_items WHERE id = ? AND cafe_id = ?', [menu_item_id, cafe_id]);
        if (menuItem.length === 0) {
            return res.status(404).json({ success: false, message: 'Menu item not found' });
        }

        const [ingredients] = await db.query(
            `SELECT mii.*, i.name as inventory_name, i.unit 
             FROM menu_item_ingredients mii
             JOIN inventory i ON mii.inventory_id = i.id
             WHERE mii.menu_item_id = ?`,
            [menu_item_id]
        );

        res.json({ success: true, ingredients });
    } catch (error) {
        console.error('Error fetching ingredients:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Set ingredients for a menu item (replaces existing)
const setMenuItemIngredients = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { cafe_id } = req.user;
        const { menu_item_id } = req.params;
        const { ingredients } = req.body; // Array of { inventory_id, quantity_required }

        // Verify menu item belongs to cafe
        const [menuItem] = await connection.query('SELECT id FROM menu_items WHERE id = ? AND cafe_id = ?', [menu_item_id, cafe_id]);
        if (menuItem.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, message: 'Menu item not found' });
        }

        await connection.beginTransaction();

        // Delete existing ingredients
        await connection.query('DELETE FROM menu_item_ingredients WHERE menu_item_id = ?', [menu_item_id]);

        // Insert new ingredients
        if (ingredients && ingredients.length > 0) {
            const values = ingredients.map(ing => [menu_item_id, ing.inventory_id, ing.quantity_required]);
            await connection.query(
                'INSERT INTO menu_item_ingredients (menu_item_id, inventory_id, quantity_required) VALUES ?',
                [values]
            );
        }

        await connection.commit();
        res.json({ success: true, message: 'Ingredients updated successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error setting ingredients:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    } finally {
        connection.release();
    }
};

module.exports = {
    getInventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    getMenuItemIngredients,
    setMenuItemIngredients
};
