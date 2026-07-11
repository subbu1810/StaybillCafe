const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

// ── POST /api/auth/register ──────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Name, phone number, and password are required' });
    }

    // Check if phone exists
    const [existing] = await db.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing.length) {
      return res.status(400).json({ success: false, message: 'Phone number already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const role = 'admin'; // First user/public registered user gets admin

    const [result] = await db.query(
      'INSERT INTO users (name, username, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, phone, hash, role, phone]
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: { id: result.insertId, name, username: phone, role, phone }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

// ── POST /api/auth/register-hotel ──────────────────────────────────────
exports.registerHotel = async (req, res) => {
  try {
    const { hotelName, name, phone, password, plan, planDuration } = req.body;
    if (!hotelName || !name || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Missing mandatory fields' });
    }

    // Check if phone exists
    const [existing] = await db.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing.length) {
      return res.status(400).json({ success: false, message: 'Phone number already registered' });
    }

    // Determine End Date
    let endDate = null;
    if (planDuration && !isNaN(planDuration)) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(planDuration, 10));
      endDate = d.toISOString().split('T')[0];
    } else if (plan === 'trial') {
      const d = new Date();
      d.setDate(d.getDate() + 7); // Default 7 days trial
      endDate = d.toISOString().split('T')[0];
    }

    // Create cafe
    const [cafeRes] = await db.query(
      'INSERT INTO cafes (name, phone, plan, subscription_end_date, is_active) VALUES (?, ?, ?, ?, 1)',
      [hotelName, phone, plan || 'trial', endDate]
    );
    const cafeId = cafeRes.insertId;

    // Create default restaurant settings
    await db.query(
      'INSERT INTO restaurant_settings (cafe_id, gst_percentage, service_charge_pct, currency, timezone, receipt_footer) VALUES (?, ?, ?, ?, ?, ?)',
      [cafeId, 5.00, 0.00, 'INR', 'Asia/Kolkata', 'Thank you for your visit!']
    );

    // Create Admin User
    const hash = await bcrypt.hash(password, 10);
    const [userRes] = await db.query(
      'INSERT INTO users (cafe_id, name, username, password_hash, role, phone, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [cafeId, name, phone, hash, 'admin', phone]
    );

    res.status(201).json({
      success: true,
      message: 'Hotel registration successful',
      user: { id: userRes.insertId, name, username: phone, role: 'admin', phone, cafe_id: cafeId, cafe_name: hotelName }
    });

  } catch (err) {
    console.error('Register Hotel error:', err);
    res.status(500).json({ success: false, message: 'Server error during hotel registration' });
  }
};

// ── POST /api/auth/login ────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    console.log('--- LOGIN ATTEMPT ---');
    console.log('req.body:', req.body);
    
    // Support both old 'username' and new 'phone' formats in case the app wasn't restarted
    const phoneInput = req.body.phone || req.body.username;
    const password = req.body.password;
    
    if (!phoneInput || !password) {
      console.log('Missing phone or password');
      return res.status(400).json({ success: false, message: 'Phone number and password are required' });
    }

    const cleanPhone = String(phoneInput).trim();
    console.log('cleanPhone:', cleanPhone);

    const [rows] = await db.query(
      'SELECT users.*, cafes.name AS cafe_name, cafes.plan, cafes.subscription_end_date, rs.captain_allow_checkout, rs.captain_allow_print, rs.captain_allow_payment FROM users LEFT JOIN cafes ON users.cafe_id = cafes.id LEFT JOIN restaurant_settings rs ON users.cafe_id = rs.cafe_id WHERE users.phone = ? AND users.is_active = 1', [cleanPhone]
    );
    console.log('rows found:', rows.length);
    
    if (!rows.length) {
      // Fallback check if they are passing username that is not a phone
      const [rowsUsername] = await db.query(
        'SELECT users.*, cafes.name AS cafe_name, cafes.plan, cafes.subscription_end_date, rs.captain_allow_checkout, rs.captain_allow_print, rs.captain_allow_payment FROM users LEFT JOIN cafes ON users.cafe_id = cafes.id LEFT JOIN restaurant_settings rs ON users.cafe_id = rs.cafe_id WHERE users.username = ? AND users.is_active = 1', [cleanPhone]
      );
      if(rowsUsername.length) {
         console.log('Found user by username instead of phone');
         rows.push(...rowsUsername);
      } else {
         console.log('No user found');
         return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    }

    const user = rows[0];
    const cleanPassword = String(password).trim();
    
    const valid = await bcrypt.compare(cleanPassword, user.password_hash);
    console.log('password valid:', valid);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, cafe_id: user.cafe_id, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { 
        id: user.id, 
        name: user.name, 
        username: user.username, 
        role: user.role, 
        phone: user.phone, 
        cafe_id: user.cafe_id, 
        cafe_name: user.cafe_name,
        plan: user.plan,
        subscription_end_date: user.subscription_end_date,
        captain_allow_checkout: !!user.captain_allow_checkout,
        captain_allow_print: !!user.captain_allow_print,
        captain_allow_payment: !!user.captain_allow_payment
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/auth/me ────────────────────────────────────────────
exports.me = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT users.id, users.cafe_id, users.name, users.username, users.role, users.phone, users.created_at, cafes.name AS cafe_name, cafes.plan, cafes.subscription_end_date, rs.captain_allow_checkout, rs.captain_allow_print, rs.captain_allow_payment FROM users LEFT JOIN cafes ON users.cafe_id = cafes.id LEFT JOIN restaurant_settings rs ON users.cafe_id = rs.cafe_id WHERE users.id = ?', [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    
    const user = rows[0];
    user.captain_allow_checkout = !!user.captain_allow_checkout;
    user.captain_allow_print = !!user.captain_allow_print;
    user.captain_allow_payment = !!user.captain_allow_payment;

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /api/auth/logout ───────────────────────────────────────
exports.logout = async (req, res) => {
  // Stateless JWT — client deletes token. We just acknowledge.
  res.json({ success: true, message: 'Logged out successfully' });
};

// ── PUT /api/auth/change-password ──────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both passwords required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
