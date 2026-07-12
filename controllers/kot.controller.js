const db = require('../config/db');

// Generate KOT number: KOT-YYYYMMDD-XXXX
const generateKOTNumber = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `KOT-${date}-${rand}`;
};

// ── POST /api/kots ──────────────────────────────────────────────
exports.sendKOT = async (req, res) => {
  try {
    const { order_id, items, priority, notes } = req.body;
    if (!order_id || !items || !items.length) {
      return res.status(400).json({ success: false, message: 'order_id and items required' });
    }

    const [orders] = await db.query('SELECT * FROM orders WHERE id = ? AND cafe_id = ?', [order_id, req.user.cafe_id]);
    if (!orders.length) return res.status(404).json({ success: false, message: 'Order not found' });

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const kotNumber = generateKOTNumber();
      const [kotResult] = await conn.query(
        'INSERT INTO kots (order_id, table_id, captain_id, kot_number, priority, notes) VALUES (?,?,?,?,?,?)',
        [order_id, orders[0].table_id, req.user.id, kotNumber, priority || 'normal', notes || null]
      );
      const kotId = kotResult.insertId;

      for (const item of items) {
        await conn.query(
          'INSERT INTO kot_items (kot_id, menu_item_id, quantity, special_instructions) VALUES (?,?,?,?)',
          [kotId, item.menu_item_id, item.quantity || 1, item.special_instructions || null]
        );
      }

      await conn.query("UPDATE orders SET status = 'kot_sent' WHERE id = ?", [order_id]);
      await conn.commit();

      const io = req.app.get('io');
      if (io) {
        io.emit('kot_new', { cafe_id: req.user.cafe_id, kotId });
      }

      res.status(201).json({ success: true, kotId, kotNumber, message: 'KOT sent to kitchen' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('sendKOT error:', err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message || 'Server error' });
  }
};

// ── GET /api/kots ───────────────────────────────────────────────
exports.getKOTs = async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT k.*, t.table_number, s.name AS section,
             u.name AS captain_name,
             TIMESTAMPDIFF(MINUTE, k.created_at, NOW()) AS elapsed_minutes
      FROM kots k
      JOIN orders o ON k.order_id = o.id
      LEFT JOIN tables t ON t.id = k.table_id
      LEFT JOIN sections s ON s.id = t.section_id
      LEFT JOIN users u ON u.id = k.captain_id
      WHERE o.cafe_id = ?
    `;
    const params = [req.user.cafe_id];
    if (status) { sql += ' AND k.status = ?'; params.push(status); }
    sql += ' ORDER BY k.created_at DESC';

    const [kots] = await db.query(sql, params);

    // Attach items
    for (const kot of kots) {
      const [items] = await db.query(`
        SELECT ki.*, m.name AS item_name, m.is_veg
        FROM kot_items ki JOIN menu_items m ON m.id = ki.menu_item_id
        WHERE ki.kot_id = ?
      `, [kot.id]);
      kot.items = items;
    }

    res.json({ success: true, kots });
  } catch (err) {
    console.error('getKOTs error:', err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message || 'Server error' });
  }
};

// ── GET /api/kots/:id ───────────────────────────────────────────
exports.getKOT = async (req, res) => {
  try {
    const [kots] = await db.query(`
      SELECT k.*, t.table_number, u.name AS captain_name,
             TIMESTAMPDIFF(MINUTE, k.created_at, NOW()) AS elapsed_minutes
      FROM kots k 
      JOIN orders o ON k.order_id = o.id
      LEFT JOIN tables t ON t.id = k.table_id 
      LEFT JOIN users u ON u.id = k.captain_id
      WHERE k.id = ? AND o.cafe_id = ?
    `, [req.params.id, req.user.cafe_id]);
    if (!kots.length) return res.status(404).json({ success: false, message: 'KOT not found' });

    const [items] = await db.query(
      'SELECT ki.*, m.name AS item_name, m.is_veg FROM kot_items ki JOIN menu_items m ON m.id = ki.menu_item_id WHERE ki.kot_id = ?',
      [req.params.id]
    );
    res.json({ success: true, kot: kots[0], items });
  } catch (err) {
    console.error('getKOT error:', err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message || 'Server error' });
  }
};

// ── PUT /api/kots/:id/status ────────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['pending','preparing','ready','served'];
    if (!valid.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    await db.query('UPDATE kots SET status=? WHERE id=? AND order_id IN (SELECT id FROM orders WHERE cafe_id=?)', [status, req.params.id, req.user.cafe_id]);
    res.json({ success: true, message: `KOT marked as ${status}` });
  } catch (err) {
    console.error('updateStatus error:', err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message || 'Server error' });
  }
};

// ── PUT /api/kots/:id/priority ──────────────────────────────────
exports.updatePriority = async (req, res) => {
  try {
    const { priority } = req.body;
    const valid = ['normal','high','urgent'];
    if (!valid.includes(priority)) return res.status(400).json({ success: false, message: 'Invalid priority' });
    await db.query('UPDATE kots SET priority=? WHERE id=? AND order_id IN (SELECT id FROM orders WHERE cafe_id=?)', [priority, req.params.id, req.user.cafe_id]);
    res.json({ success: true, message: `Priority set to ${priority}` });
  } catch (err) {
    console.error('updatePriority error:', err);
    res.status(500).json({ success: false, message: err.sqlMessage || err.message || 'Server error' });
  }
};
