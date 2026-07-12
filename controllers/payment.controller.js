const db = require('../config/db');

// ── POST /api/payments ──────────────────────────────────────────
exports.recordPayment = async (req, res) => {
  try {
    const { bill_id, method, amount, transaction_ref } = req.body;
    if (!bill_id || !method || !amount) {
      return res.status(400).json({ success: false, message: 'bill_id, method, amount required' });
    }

    const [bills] = await db.query('SELECT * FROM bills WHERE id = ? AND cafe_id = ?', [bill_id, req.user.cafe_id]);
    if (!bills.length) return res.status(404).json({ success: false, message: 'Bill not found' });

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

    if (method === 'split' && req.body.split_payments && Array.isArray(req.body.split_payments)) {
        for (const sp of req.body.split_payments) {
          await conn.query(
            'INSERT INTO payments (bill_id, method, amount, transaction_ref, status) VALUES (?,?,?,?,?)',
            [bill_id, sp.method, sp.amount, transaction_ref || null, 'success']
          );
        }
      } else {
        await conn.query(
          'INSERT INTO payments (bill_id, method, amount, transaction_ref, status) VALUES (?,?,?,?,?)',
          [bill_id, method, amount, transaction_ref || null, 'success']
        );
      }

      // Mark bill paid
      await conn.query("UPDATE bills SET status = 'paid' WHERE id = ? AND cafe_id = ?", [bill_id, req.user.cafe_id]);

      // Mark order paid
      await conn.query("UPDATE orders SET status = 'paid' WHERE id = ? AND cafe_id = ?", [bills[0].order_id, req.user.cafe_id]);

      // Free the table
      await conn.query("UPDATE tables SET status = 'available' WHERE id = ? AND cafe_id = ?", [bills[0].table_id, req.user.cafe_id]);
      const io = req.app.get('io');
      if (io) io.emit('table_updated', { table_id: bills[0].table_id, status: 'available' });
      if (io) io.emit('order_updated', { order_id: bills[0].order_id, status: 'paid' });

      // Update customer loyalty (if applicable)
      const [orders] = await conn.query('SELECT customer_id FROM orders WHERE id = ? AND cafe_id = ?', [bills[0].order_id, req.user.cafe_id]);
      if (orders[0]?.customer_id) {
        const points = Math.floor(bills[0].grand_total / 100); // 1 point per ₹100
        await conn.query(
          'UPDATE customers SET total_visits = total_visits + 1, loyalty_points = loyalty_points + ? WHERE id = ? AND cafe_id = ?',
          [points, orders[0].customer_id, req.user.cafe_id]
        );
      }

      await conn.commit();
      res.status(201).json({ success: true, message: 'Payment recorded successfully' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/payments/today ─────────────────────────────────────
exports.getTodayPayments = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, b.bill_number, b.grand_total, t.table_number
      FROM payments p
      JOIN bills b ON b.id = p.bill_id
      JOIN tables t ON t.id = b.table_id
      WHERE p.cafe_id = ? AND DATE(p.paid_at) = CURDATE() AND p.status = 'success'
      ORDER BY p.paid_at DESC
    `, [req.user.cafe_id]);

    const [summary] = await db.query(`
      SELECT
        COUNT(*) AS total_transactions,
        SUM(amount) AS total_collection,
        SUM(CASE WHEN method='cash'   THEN amount ELSE 0 END) AS cash,
        SUM(CASE WHEN method='upi'    THEN amount ELSE 0 END) AS upi,
        SUM(CASE WHEN method='card'   THEN amount ELSE 0 END) AS card,
        SUM(CASE WHEN method='wallet' THEN amount ELSE 0 END) AS wallet
      FROM payments
      WHERE cafe_id = ? AND DATE(paid_at) = CURDATE() AND status = 'success'
    `, [req.user.cafe_id]);

    res.json({ success: true, payments: rows, summary: summary[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/payments/bill/:billId ──────────────────────────────
exports.getPaymentByBill = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM payments WHERE bill_id = ? AND cafe_id = ?', [req.params.billId, req.user.cafe_id]);
    res.json({ success: true, payments: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
