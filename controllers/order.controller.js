const db = require('../config/db');

// ── POST /api/orders ────────────────────────────────────────────
exports.createOrder = async (req, res) => {
  try {
    const { table_id, guest_count, customer_id, items, order_type = 'dine_in' } = req.body;
    if ((!table_id && order_type === 'dine_in') || !items || !items.length) {
      return res.status(400).json({ success: false, message: 'table_id and items required for dine_in' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Create order
      const [orderResult] = await conn.query(
        'INSERT INTO orders (cafe_id, table_id, captain_id, customer_id, guest_count, order_type) VALUES (?,?,?,?,?,?)',
        [req.user.cafe_id, table_id || null, req.user.id, customer_id || null, guest_count || 1, order_type]
      );
      const orderId = orderResult.insertId;

      // Add items
      for (const item of items) {
        const [menuItem] = await conn.query('SELECT price FROM menu_items WHERE id = ? AND cafe_id = ?', [item.menu_item_id, req.user.cafe_id]);
        if (!menuItem.length) throw new Error(`Menu item ${item.menu_item_id} not found`);
        await conn.query(
          'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, special_instructions) VALUES (?,?,?,?,?)',
          [orderId, item.menu_item_id, item.quantity || 1, menuItem[0].price, item.special_instructions || null]
        );
      }

      // Mark table occupied if dine_in
      if (order_type === 'dine_in' && table_id) {
        await conn.query("UPDATE tables SET status = 'occupied' WHERE id = ? AND cafe_id = ?", [table_id, req.user.cafe_id]);
        const io = req.app.get('io');
        if (io) io.emit('table_updated', { table_id, status: 'occupied' });
      }

      await conn.commit();
      const io = req.app.get('io');
      if (io) io.emit('order_updated', { order_id: orderId });
      res.status(201).json({ success: true, orderId, message: 'Order created' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

// ── GET /api/orders/running ─────────────────────────────────────
exports.getRunningOrders = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT o.id, o.status, o.guest_count, o.created_at, o.order_type,
             t.table_number, t.status AS table_status, s.name AS section,
             u.name AS captain_name,
             (
               SELECT JSON_ARRAYAGG(JSON_OBJECT('name', m.name, 'quantity', oi.quantity))
               FROM order_items oi
               JOIN menu_items m ON m.id = oi.menu_item_id
               WHERE oi.order_id = o.id
             ) AS items,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
             (SELECT SUM(oi.quantity * oi.unit_price) FROM order_items oi WHERE oi.order_id = o.id) AS subtotal
      FROM orders o
      LEFT JOIN tables t ON t.id = o.table_id
      LEFT JOIN sections s ON s.id = t.section_id
      LEFT JOIN users u ON u.id = o.captain_id
      WHERE o.cafe_id = ? AND o.status NOT IN ('paid','cancelled')
      ORDER BY o.created_at DESC
    `, [req.user.cafe_id]);
    res.json({ success: true, orders: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/orders/:id ─────────────────────────────────────────
exports.getOrder = async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT o.*, t.table_number, s.name AS section,
             u.name AS captain_name, c.name AS customer_name
      FROM orders o
      LEFT JOIN tables t ON t.id = o.table_id
      LEFT JOIN sections s ON s.id = t.section_id
      LEFT JOIN users u ON u.id = o.captain_id
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ?
    `, [req.params.id]);
    if (!orders.length) return res.status(404).json({ success: false, message: 'Order not found' });

    const [items] = await db.query(`
      SELECT oi.*, m.name AS item_name, m.is_veg, cat.name AS category
      FROM order_items oi
      JOIN menu_items m ON m.id = oi.menu_item_id
      JOIN categories cat ON cat.id = m.category_id
      WHERE oi.order_id = ?
    `, [req.params.id]);

    res.json({ success: true, order: orders[0], items });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/orders/:id/items ──────────────────────────────────
exports.addItems = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !items.length) return res.status(400).json({ success: false, message: 'items required' });

    for (const item of items) {
      const [menuItem] = await db.query('SELECT price FROM menu_items WHERE id = ?', [item.menu_item_id]);
      if (!menuItem.length) continue;
      await db.query(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, special_instructions) VALUES (?,?,?,?,?)',
        [req.params.id, item.menu_item_id, item.quantity || 1, menuItem[0].price, item.special_instructions || null]
      );
    }
    const io = req.app.get('io');
    if (io) io.emit('order_updated', { order_id: req.params.id });
    res.json({ success: true, message: 'Items added to order' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/orders/:id/items/:itemId ───────────────────────────
exports.updateItem = async (req, res) => {
  try {
    const { quantity, special_instructions } = req.body;
    await db.query(
      'UPDATE order_items SET quantity=?, special_instructions=? WHERE id=? AND order_id=?',
      [quantity, special_instructions, req.params.itemId, req.params.id]
    );
    const io = req.app.get('io');
    if (io) io.emit('order_updated', { order_id: req.params.id });
    res.json({ success: true, message: 'Item updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── DELETE /api/orders/:id/items/:itemId ────────────────────────
exports.removeItem = async (req, res) => {
  try {
    await db.query('DELETE FROM order_items WHERE id=? AND order_id=?', [req.params.itemId, req.params.id]);
    const io = req.app.get('io');
    if (io) io.emit('order_updated', { order_id: req.params.id });
    res.json({ success: true, message: 'Item removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/orders/:id/status ──────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE orders SET status=? WHERE id=?', [status, req.params.id]);
    const io = req.app.get('io');
    if (io) io.emit('order_updated', { order_id: req.params.id, status });
    res.json({ success: true, message: 'Order status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
