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

// ── POST /api/orders/:id/cancel-item ────────────────────────
exports.cancelItem = async (req, res) => {
  try {
    const { order_item_id, quantity_to_cancel } = req.body;
    const orderId = req.params.id;

    // Check permissions
    if (req.user.role === 'captain') {
      const [settingsRows] = await db.query('SELECT captain_allow_cancel_item FROM restaurant_settings WHERE cafe_id = ?', [req.user.cafe_id]);
      const allowCancel = settingsRows.length > 0 ? settingsRows[0].captain_allow_cancel_item : 0;
      if (!allowCancel) {
        return res.status(403).json({ success: false, message: 'Captains are not allowed to cancel items.' });
      }
    }

    const [itemRows] = await db.query('SELECT * FROM order_items WHERE id=? AND order_id=?', [order_item_id, orderId]);
    if (!itemRows.length) return res.status(404).json({ success: false, message: 'Item not found in order' });
    const item = itemRows[0];

    // Deduct or delete
    if (quantity_to_cancel >= item.quantity) {
      await db.query('DELETE FROM order_items WHERE id=?', [order_item_id]);
    } else {
      await db.query('UPDATE order_items SET quantity = quantity - ? WHERE id=?', [quantity_to_cancel, order_item_id]);
    }

    // Check if any items remain in the order
    const [remainingItems] = await db.query('SELECT COUNT(*) as cnt FROM order_items WHERE order_id=?', [orderId]);
    const orderEmpty = remainingItems[0].cnt === 0;

    // Get order info for Cancel KOT
    const [orderRows] = await db.query(
      `SELECT o.*, t.table_number, u.name as waiter_name, c.name as cafe_name
       FROM orders o 
       LEFT JOIN tables t ON o.table_id = t.id
       LEFT JOIN users u ON o.captain_id = u.id
       LEFT JOIN cafes c ON o.cafe_id = c.id
       WHERE o.id = ?`, [orderId]
    );

    // If all items are removed → cancel the order and free the table
    if (orderEmpty && orderRows.length) {
      await db.query("UPDATE orders SET status='cancelled' WHERE id=?", [orderId]);
      if (orderRows[0].table_id) {
        await db.query("UPDATE tables SET status='available' WHERE id=?", [orderRows[0].table_id]);
      }
    }

    const [menuItemRows] = await db.query('SELECT name FROM menu_items WHERE id=?', [item.menu_item_id]);
    const menuItemName = menuItemRows.length ? menuItemRows[0].name : 'Unknown Item';

    const cancelKOT = {
      is_cancel: true,
      kot_number: 'CANCEL-' + Date.now().toString().slice(-4),
      order_id: orderId,
      table_number: orderRows[0]?.table_number || 'Takeaway',
      waiter_name: orderRows[0]?.waiter_name,
      cafe_name: orderRows[0]?.cafe_name,
      created_at: new Date(),
      items: [{
        name: menuItemName,
        quantity: quantity_to_cancel,
        notes: item.special_instructions
      }]
    };

    const io = req.app.get('io');
    if (io) {
      io.emit('order_updated', { order_id: orderId });
      io.emit('cancel_kot', cancelKOT);
      if (orderEmpty) io.emit('order_cancelled', { order_id: orderId });
    }

    res.json({ success: true, message: 'Item cancelled', cancelKOT, order_cancelled: orderEmpty });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

