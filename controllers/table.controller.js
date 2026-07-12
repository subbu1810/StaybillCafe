const db = require('../config/db');

// ── GET /api/tables ─────────────────────────────────────────────
exports.getTables = async (req, res) => {
  try {
    const { section_id, status } = req.query;
    let sql = `
      SELECT t.*, s.name AS section_name,
        (SELECT COUNT(*) FROM orders o WHERE o.table_id = t.id AND o.status NOT IN ('paid','cancelled')) AS active_orders,
        (SELECT o.id FROM orders o WHERE o.table_id = t.id AND o.status NOT IN ('paid','cancelled') ORDER BY o.created_at DESC LIMIT 1) AS active_order_id,
        (SELECT o.created_at FROM orders o WHERE o.table_id = t.id AND o.status NOT IN ('paid','cancelled') ORDER BY o.created_at DESC LIMIT 1) AS order_created_at
      FROM tables t
      LEFT JOIN sections s ON s.id = t.section_id
      WHERE t.cafe_id = ?
    `;
    const params = [req.user.cafe_id];
    if (section_id) { sql += ' AND t.section_id = ?'; params.push(section_id); }
    if (status)     { sql += ' AND t.status = ?';     params.push(status); }
    sql += ' ORDER BY t.section_id, t.table_number';

    const [rows] = await db.query(sql, params);

    // Group by section
    const sections = {};
    rows.forEach(t => {
      const key = t.section_name || 'Other';
      if (!sections[key]) sections[key] = [];
      sections[key].push(t);
    });

    res.json({ success: true, tables: rows, grouped: sections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/tables/:id ─────────────────────────────────────────
exports.getTable = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT t.*, s.name AS section_name
      FROM tables t LEFT JOIN sections s ON s.id = t.section_id
      WHERE t.id = ? AND t.cafe_id = ?
    `, [req.params.id, req.user.cafe_id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Table not found' });

    // Get active order if any
    const [orders] = await db.query(`
      SELECT o.id, o.status, o.guest_count, o.created_at,
             u.name AS captain_name
      FROM orders o
      LEFT JOIN users u ON u.id = o.captain_id
      WHERE o.table_id = ? AND o.status NOT IN ('paid','cancelled')
      ORDER BY o.created_at DESC LIMIT 1
    `, [req.params.id]);

    res.json({ success: true, table: rows[0], activeOrder: orders[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/tables/:id/status ──────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['available','occupied','reserved','billing','cleaning'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    await db.query('UPDATE tables SET status = ? WHERE id = ? AND cafe_id = ?', [status, req.params.id, req.user.cafe_id]);
    const io = req.app.get('io');
    if (io) {
      io.emit('table_updated', { table_id: req.params.id, status });
    }
    res.json({ success: true, message: `Table status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/tables ────────────────────────────────────────────
exports.addTable = async (req, res) => {
  try {
    const { section_id, table_number, capacity } = req.body;
    if (!table_number) return res.status(400).json({ success: false, message: 'table_number required' });
    const [result] = await db.query(
      'INSERT INTO tables (cafe_id, section_id, table_number, capacity) VALUES (?,?,?,?)',
      [req.user.cafe_id, section_id, table_number, capacity || 4]
    );
    res.status(201).json({ success: true, id: result.insertId, message: 'Table added' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/tables/:id ─────────────────────────────────────────
exports.updateTable = async (req, res) => {
  try {
    const { section_id, table_number, capacity } = req.body;
    await db.query(
      'UPDATE tables SET section_id=?, table_number=?, capacity=? WHERE id=? AND cafe_id = ?',
      [section_id, table_number, capacity, req.params.id, req.user.cafe_id]
    );
    res.json({ success: true, message: 'Table updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── DELETE /api/tables/:id ──────────────────────────────────────
exports.deleteTable = async (req, res) => {
  try {
    await db.query('DELETE FROM tables WHERE id = ? AND cafe_id = ?', [req.params.id, req.user.cafe_id]);
    res.json({ success: true, message: 'Table deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/tables/sections ────────────────────────────────────
exports.getSections = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM sections WHERE cafe_id = ? ORDER BY id', [req.user.cafe_id]);
    res.json({ success: true, sections: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/tables/sections ───────────────────────────────────
exports.addSection = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Section name required' });
    const [result] = await db.query('INSERT INTO sections (cafe_id, name) VALUES (?,?)', [req.user.cafe_id, name]);
    res.status(201).json({ success: true, id: result.insertId, message: 'Section added' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/tables/sections/:id ────────────────────────────────
exports.updateSection = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Section name required' });
    await db.query('UPDATE sections SET name=? WHERE id=? AND cafe_id=?', [name, req.params.id, req.user.cafe_id]);
    res.json({ success: true, message: 'Section updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── DELETE /api/tables/sections/:id ─────────────────────────────
exports.deleteSection = async (req, res) => {
  try {
    // Prevent deleting a section that has tables
    const [tables] = await db.query('SELECT COUNT(*) as count FROM tables WHERE section_id = ? AND cafe_id = ?', [req.params.id, req.user.cafe_id]);
    if (tables[0].count > 0) {
      return res.status(400).json({ success: false, message: 'Remove all tables in this section first' });
    }
    await db.query('DELETE FROM sections WHERE id = ? AND cafe_id = ?', [req.params.id, req.user.cafe_id]);
    res.json({ success: true, message: 'Section deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

