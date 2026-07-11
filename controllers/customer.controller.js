const db = require('../config/db');

exports.getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM customers WHERE cafe_id = ?';
    const params = [req.user.cafe_id];
    if (search) { sql += ' AND (name LIKE ? OR mobile LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY total_visits DESC';
    const [rows] = await db.query(sql, params);
    res.json({ success: true, customers: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getCustomer = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM customers WHERE id = ? AND cafe_id = ?', [req.params.id, req.user.cafe_id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, customer: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.addCustomer = async (req, res) => {
  try {
    const { name, mobile, email, birthday } = req.body;
    if (!name || !mobile) return res.status(400).json({ success: false, message: 'name and mobile required' });
    const [r] = await db.query(
      'INSERT INTO customers (cafe_id, name, mobile, email, birthday) VALUES (?,?,?,?,?)',
      [req.user.cafe_id, name, mobile, email || null, birthday || null]
    );
    res.status(201).json({ success: true, id: r.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Mobile already registered' });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { name, mobile, email, birthday } = req.body;
    await db.query('UPDATE customers SET name=?, mobile=?, email=?, birthday=? WHERE id=? AND cafe_id=?',
      [name, mobile, email, birthday, req.params.id, req.user.cafe_id]);
    res.json({ success: true, message: 'Customer updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getCustomerOrders = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT o.id, o.status, o.created_at, t.table_number,
             b.grand_total, b.bill_number, b.status AS bill_status
      FROM orders o
      JOIN tables t ON t.id = o.table_id
      LEFT JOIN bills b ON b.order_id = o.id
      WHERE o.customer_id = ? AND o.cafe_id = ?
      ORDER BY o.created_at DESC LIMIT 20
    `, [req.params.id, req.user.cafe_id]);
    res.json({ success: true, orders: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
