const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const { date } = req.query;
    let sql = 'SELECT e.*, u.name AS created_by_name FROM expenses e LEFT JOIN users u ON u.id = e.created_by WHERE e.cafe_id = ?';
    const params = [req.user.cafe_id];
    if (date) { sql += ' AND e.expense_date = ?'; params.push(date); }
    else       { sql += ' AND MONTH(e.expense_date) = MONTH(CURDATE()) AND YEAR(e.expense_date) = YEAR(CURDATE())'; }
    sql += ' ORDER BY e.expense_date DESC';
    const [rows] = await db.query(sql, params);
    res.json({ success: true, expenses: rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.create = async (req, res) => {
  try {
    const { category, description, amount, payment_method, expense_date } = req.body;
    const [r] = await db.query(
      'INSERT INTO expenses (cafe_id, category, description, amount, payment_method, expense_date, created_by) VALUES (?,?,?,?,?,?,?)',
      [req.user.cafe_id, category, description, amount, payment_method || 'cash', expense_date || new Date(), req.user.id]
    );
    res.status(201).json({ success: true, id: r.insertId });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.update = async (req, res) => {
  try {
    const { category, description, amount, payment_method, expense_date } = req.body;
    await db.query(
      'UPDATE expenses SET category=?,description=?,amount=?,payment_method=?,expense_date=? WHERE id=? AND cafe_id=?',
      [category, description, amount, payment_method, expense_date, req.params.id, req.user.cafe_id]
    );
    res.json({ success: true, message: 'Expense updated' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

exports.remove = async (req, res) => {
  try {
    await db.query('DELETE FROM expenses WHERE id = ? AND cafe_id = ?', [req.params.id, req.user.cafe_id]);
    res.json({ success: true, message: 'Expense deleted' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};
