const db = require('../config/db');

// ── Categories ───────────────────────────────────────────────────

exports.getCategories = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT *, (SELECT COUNT(*) FROM menu_items m WHERE m.category_id = categories.id AND m.is_available=1) AS item_count
       FROM categories WHERE cafe_id = ? AND is_active = 1 ORDER BY sort_order`,
      [req.user.cafe_id]
    );
    res.json({ success: true, categories: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.addCategory = async (req, res) => {
  try {
    const { name, icon, color, sort_order } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name required' });
    const [r] = await db.query(
      'INSERT INTO categories (cafe_id, name, icon, color, sort_order) VALUES (?,?,?,?,?)',
      [req.user.cafe_id, name, icon, color, sort_order || 0]
    );
    res.status(201).json({ success: true, id: r.insertId });
  } catch (err) {
    console.error('addCategory error:', err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message || 'Server error' });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { name, icon, color, sort_order, is_active } = req.body;
    await db.query(
      'UPDATE categories SET name=?, icon=?, color=?, sort_order=?, is_active=? WHERE id=? AND cafe_id=?',
      [name, icon, color, sort_order, is_active, req.params.id, req.user.cafe_id]
    );
    res.json({ success: true, message: 'Category updated' });
  } catch (err) {
    console.error('updateCategory error:', err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message || 'Server error' });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    await db.query('UPDATE categories SET is_active = 0 WHERE id = ? AND cafe_id = ?', [req.params.id, req.user.cafe_id]);
    res.json({ success: true, message: 'Category removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Menu Items ───────────────────────────────────────────────────

exports.getItems = async (req, res) => {
  try {
    const { category_id, search, available } = req.query;
    let sql = `
      SELECT m.*, c.name AS category_name, c.color AS category_color
      FROM menu_items m
      JOIN categories c ON c.id = m.category_id
      WHERE m.cafe_id = ? AND c.is_active = 1
    `;
    const params = [req.user.cafe_id];
    if (category_id) { sql += ' AND m.category_id = ?'; params.push(category_id); }
    if (available === '1') { sql += ' AND m.is_available = 1'; }
    if (search) { sql += ' AND m.name LIKE ?'; params.push(`%${search}%`); }
    sql += ' ORDER BY c.sort_order, m.name';

    const [rows] = await db.query(sql, params);
    res.json({ success: true, items: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getItem = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT m.*, c.name AS category_name FROM menu_items m JOIN categories c ON c.id = m.category_id WHERE m.id = ? AND m.cafe_id = ?',
      [req.params.id, req.user.cafe_id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, item: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.addItem = async (req, res) => {
  try {
    const { category_id, name, description, price, image_url, is_available, is_veg } = req.body;
    if (!category_id || !name || !price) {
      return res.status(400).json({ success: false, message: 'category_id, name, price required' });
    }
    const [r] = await db.query(
      'INSERT INTO menu_items (cafe_id, category_id, name, description, price, image_url, is_available, is_veg) VALUES (?,?,?,?,?,?,?,?)',
      [req.user.cafe_id, category_id, name, description, price, image_url, is_available ?? 1, is_veg ?? 1]
    );
    res.status(201).json({ success: true, id: r.insertId, message: 'Item added' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { category_id, name, description, price, image_url, is_available, is_veg } = req.body;
    await db.query(
      'UPDATE menu_items SET category_id=?, name=?, description=?, price=?, image_url=?, is_available=?, is_veg=? WHERE id=? AND cafe_id=?',
      [category_id, name, description, price, image_url, is_available, is_veg, req.params.id, req.user.cafe_id]
    );
    res.json({ success: true, message: 'Item updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.toggleAvailability = async (req, res) => {
  try {
    await db.query(
      'UPDATE menu_items SET is_available = NOT is_available WHERE id = ? AND cafe_id = ?', [req.params.id, req.user.cafe_id]
    );
    const [rows] = await db.query('SELECT is_available FROM menu_items WHERE id = ?', [req.params.id]);
    res.json({ success: true, is_available: !!rows[0]?.is_available });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    await db.query('DELETE FROM menu_items WHERE id = ? AND cafe_id = ?', [req.params.id, req.user.cafe_id]);
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
