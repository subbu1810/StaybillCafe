const bcrypt = require('bcryptjs');
const db     = require('../config/db');

// ── GET /api/superadmin/cafes ────────────────────────────────────
exports.listCafes = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM users u WHERE u.cafe_id = c.id) AS user_count,
        (SELECT COUNT(*) FROM orders o WHERE o.cafe_id = c.id AND DATE(o.created_at) = CURDATE()) AS orders_today
      FROM cafes c ORDER BY c.created_at DESC
    `);
    res.json({ success: true, cafes: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/superadmin/cafes ───────────────────────────────────
exports.createCafe = async (req, res) => {
  try {
    const { 
      name, address, phone, email, gst_number, plan, planDuration,
      gst_percentage, service_charge_pct, currency, timezone, receipt_footer,
      is_gst_enabled, printer_size, upi_id, is_upi_enabled
    } = req.body;
    
    if (!name) return res.status(400).json({ success: false, message: 'Cafe name required' });

    let endDate = null;
    if (planDuration && !isNaN(planDuration)) {
      endDate = new Date();
      endDate.setMonth(endDate.getMonth() + Number(planDuration));
    }

    const [result] = await db.query(
      'INSERT INTO cafes (name, address, phone, email, gst_number, plan, subscription_end_date) VALUES (?,?,?,?,?,?,?)',
      [name, address, phone, email, gst_number, plan || 'trial', endDate]
    );
    const cafeId = result.insertId;

    // Seed default settings for the new cafe, but with the user's provided values
    await db.query(
      `INSERT INTO restaurant_settings 
        (cafe_id, name, address, phone, email, gst_number, gst_percentage, service_charge_pct, currency, timezone, receipt_footer, is_gst_enabled, printer_size, upi_id, is_upi_enabled) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        cafeId, name, address || null, phone || null, email || null, gst_number || null,
        gst_percentage || 5.00, 
        service_charge_pct || 0.00, 
        currency || 'INR', 
        timezone || 'Asia/Kolkata', 
        receipt_footer || null, 
        is_gst_enabled ? 1 : 0, 
        printer_size || '58mm', 
        upi_id || null, 
        is_upi_enabled ? 1 : 0
      ]
    );

    res.status(201).json({ success: true, cafe_id: cafeId, message: 'Cafe created' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/superadmin/cafes/:id ────────────────────────────────
exports.updateCafe = async (req, res) => {
  try {
    const { name, address, phone, email, gst_number, plan, is_active } = req.body;
    await db.query(
      'UPDATE cafes SET name=?,address=?,phone=?,email=?,gst_number=?,plan=?,is_active=? WHERE id=?',
      [name, address, phone, email, gst_number, plan, is_active, req.params.id]
    );
    res.json({ success: true, message: 'Cafe updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── DELETE /api/superadmin/cafes/:id (deactivate only) ──────────
exports.deactivateCafe = async (req, res) => {
  try {
    await db.query('UPDATE cafes SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Cafe deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/superadmin/cafes/:id/admin ─────────────────────────
// Create the first admin user for a cafe
exports.createCafeAdmin = async (req, res) => {
  try {
    const { name, username, password, phone } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ success: false, message: 'name, username and password required' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length) {
      return res.status(400).json({ success: false, message: 'Username already taken' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (cafe_id, name, username, password_hash, role, phone) VALUES (?,?,?,?,?,?)',
      [req.params.id, name, username, hash, 'admin', phone || null]
    );

    res.status(201).json({ success: true, user_id: result.insertId, message: 'Admin user created for cafe' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/superadmin/cafes/:id/stats ──────────────────────────
exports.getCafeStats = async (req, res) => {
  try {
    const cafeId = req.params.id;
    const [[{ orders_total }]]  = await db.query('SELECT COUNT(*) AS orders_total FROM orders WHERE cafe_id = ?', [cafeId]);
    const [[{ revenue_total }]] = await db.query(`SELECT COALESCE(SUM(grand_total),0) AS revenue_total FROM bills WHERE cafe_id = ? AND status='paid'`, [cafeId]);
    const [[{ users_count }]]   = await db.query('SELECT COUNT(*) AS users_count FROM users WHERE cafe_id = ?', [cafeId]);
    const [[{ tables_count }]]  = await db.query('SELECT COUNT(*) AS tables_count FROM `tables` WHERE cafe_id = ?', [cafeId]);

    res.json({ success: true, stats: { orders_total, revenue_total, users_count, tables_count } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/superadmin/cafes/:id ────────────────────────────────────
exports.getCafe = async (req, res) => {
  try {
    const [[cafe]] = await db.query('SELECT * FROM cafes WHERE id = ?', [req.params.id]);
    if (!cafe) return res.status(404).json({ success: false, message: 'Cafe not found' });
    res.json({ success: true, cafe });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/superadmin/cafes/:id/users ──────────────────────────
exports.getCafeUsers = async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, name, username, role, phone, is_active FROM users WHERE cafe_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/superadmin/users/:id/deactivate ─────────────────────
exports.deactivateUser = async (req, res) => {
  try {
    // Only allows toggling the is_active status
    const [[user]] = await db.query('SELECT is_active FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    const newStatus = user.is_active === 1 ? 0 : 1;
    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
    res.json({ success: true, message: `User ${newStatus === 1 ? 'activated' : 'deactivated'}`, is_active: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/superadmin/users/:id/password ──────────────────────────────
exports.updateUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(newPassword, 10);
    const [result] = await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, message: 'User password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/superadmin/cafes/:id/sales-chart ────────────────────
exports.getCafeSalesChart = async (req, res) => {
  try {
    // Return daily sales for the last 7 days
    const [sales] = await db.query(`
      SELECT 
        DATE(created_at) as date, 
        COALESCE(SUM(grand_total), 0) as revenue,
        COUNT(id) as orders
      FROM bills 
      WHERE cafe_id = ? AND status = 'paid' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [req.params.id]);
    
    // Fill missing days
    const chartData = [];
    for(let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = sales.find(s => s.date.toISOString().split('T')[0] === dateStr);
      chartData.push({
        date: dateStr,
        revenue: found ? parseFloat(found.revenue) : 0,
        orders: found ? found.orders : 0
      });
    }

    res.json({ success: true, sales: chartData });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/superadmin/stats ────────────────────────────────────
// Global platform stats
exports.globalStats = async (req, res) => {
  try {
    const [[{ total_cafes }]]   = await db.query('SELECT COUNT(*) AS total_cafes FROM cafes WHERE is_active = 1');
    const [[{ total_orders }]]  = await db.query('SELECT COUNT(*) AS total_orders FROM orders WHERE DATE(created_at) = CURDATE()');
    const [[{ total_revenue }]] = await db.query(`SELECT COALESCE(SUM(grand_total),0) AS total_revenue FROM bills WHERE status='paid' AND DATE(created_at) = CURDATE()`);

    res.json({ success: true, stats: { total_cafes, total_orders_today: total_orders, total_revenue_today: total_revenue } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
