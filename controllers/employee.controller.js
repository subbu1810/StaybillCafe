const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT e.*, u.username 
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.cafe_id = ? 
      ORDER BY e.name
    `, [req.user.cafe_id]);
    res.json({ success: true, employees: rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM employees WHERE id = ? AND cafe_id = ?', [req.params.id, req.user.cafe_id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, employee: rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.create = async (req, res) => {
  try {
    const { name, role, phone, email, salary, joining_date, username, password } = req.body;
    if (!name || !role || !username || !password) {
      return res.status(400).json({ success: false, message: 'Name, role, username, and password are required' });
    }

    // Role limit enforcement
    const limits = { cashier: 1, captain: 2, kitchen: 1 };
    if (limits[role]) {
      const [countResult] = await db.query('SELECT count(*) as cnt FROM users WHERE cafe_id=? AND role=? AND is_active=1', [req.user.cafe_id, role]);
      if (countResult[0].cnt >= limits[role]) {
        return res.status(400).json({ 
          success: false, 
          message: `Limit reached for role: ${role}. Maximum allowed is ${limits[role]}.` 
        });
      }
    }

    // Check if username exists
    const [existingUser] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser.length > 0) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert into users
    const [userRes] = await db.query(
      'INSERT INTO users (cafe_id, name, username, password_hash, role, phone) VALUES (?,?,?,?,?,?)',
      [req.user.cafe_id, name, username, password_hash, role, phone]
    );
    const user_id = userRes.insertId;

    // Insert into employees
    const [r] = await db.query(
      'INSERT INTO employees (cafe_id, user_id, name, role, phone, email, salary, joining_date) VALUES (?,?,?,?,?,?,?,?)',
      [req.user.cafe_id, user_id, name, role, phone, email, salary, joining_date]
    );
    res.status(201).json({ success: true, id: r.insertId, message: 'Employee created successfully' });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' }); 
  }
};

exports.update = async (req, res) => {
  try {
    const { name, role, phone, email, salary, joining_date, is_active, username, password } = req.body;
    
    // Fetch current employee to get user_id and current role
    const [empRows] = await db.query('SELECT user_id, role FROM employees WHERE id=? AND cafe_id=?', [req.params.id, req.user.cafe_id]);
    if (!empRows.length) return res.status(404).json({ success: false, message: 'Employee not found' });
    const emp = empRows[0];

    // If role is changing, re-validate limits
    if (role && role !== emp.role) {
      const limits = { cashier: 1, captain: 2, kitchen: 1 };
      if (limits[role]) {
        const [countResult] = await db.query('SELECT count(*) as cnt FROM users WHERE cafe_id=? AND role=? AND is_active=1', [req.user.cafe_id, role]);
        if (countResult[0].cnt >= limits[role]) {
          return res.status(400).json({ 
            success: false, 
            message: `Limit reached for role: ${role}. Maximum allowed is ${limits[role]}.` 
          });
        }
      }
    }

    // Check if new username is taken by someone else
    if (username) {
      const [existingUser] = await db.query('SELECT id FROM users WHERE username = ? AND id != ?', [username, emp.user_id]);
      if (existingUser.length > 0) {
        return res.status(400).json({ success: false, message: 'Username already taken' });
      }
    }

    // Update users table if user_id exists
    if (emp.user_id) {
      let query = 'UPDATE users SET name=?, role=?, phone=?';
      let params = [name, role, phone];

      if (username) {
        query += ', username=?';
        params.push(username);
      }
      if (password) {
        query += ', password_hash=?';
        params.push(await bcrypt.hash(password, 10));
      }
      if (is_active !== undefined) {
        query += ', is_active=?';
        params.push(is_active);
      }
      query += ' WHERE id=?';
      params.push(emp.user_id);
      await db.query(query, params);
    }

    // Update employees table
    await db.query(
      'UPDATE employees SET name=?,role=?,phone=?,email=?,salary=?,joining_date=?,is_active=? WHERE id=? AND cafe_id=?',
      [name, role, phone, email, salary, joining_date, is_active, req.params.id, req.user.cafe_id]
    );
    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' }); 
  }
};

exports.remove = async (req, res) => {
  try {
    const [empRows] = await db.query('SELECT user_id FROM employees WHERE id = ? AND cafe_id = ?', [req.params.id, req.user.cafe_id]);
    if (!empRows.length) return res.status(404).json({ success: false, message: 'Employee not found' });
    
    const userId = empRows[0].user_id;

    // Delete from employees permanently
    await db.query('DELETE FROM employees WHERE id = ? AND cafe_id = ?', [req.params.id, req.user.cafe_id]);
    
    // Delete from users permanently
    if (userId) {
      await db.query('DELETE FROM users WHERE id = ?', [userId]);
    }

    res.json({ success: true, message: 'Employee deleted permanently' });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' }); 
  }
};
