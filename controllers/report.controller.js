const db = require('../config/db');
const PDFDocument = require('pdfkit-table');

// ── GET /api/reports/summary ─────────────────────────────────────
exports.getSummary = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const [sales] = await db.query(`
      SELECT
        COALESCE(SUM(grand_total), 0) AS total_sales,
        COUNT(*) AS total_bills,
        COALESCE(AVG(grand_total), 0) AS avg_bill
      FROM bills WHERE cafe_id = ? AND DATE(created_at) = ? AND status = 'paid'
    `, [req.user.cafe_id, targetDate]);

    const [kots] = await db.query(
      "SELECT COUNT(*) AS total_kots FROM kots WHERE cafe_id = ? AND DATE(created_at) = ?", [req.user.cafe_id, targetDate]
    );

    const [tables] = await db.query(
      "SELECT COUNT(*) AS running_tables FROM tables WHERE cafe_id = ? AND status IN ('occupied','billing')", [req.user.cafe_id]
    );

    const [collection] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) AS total_collection
      FROM payments WHERE cafe_id = ? AND DATE(paid_at) = ? AND status = 'success'
    `, [req.user.cafe_id, targetDate]);

    const [customers] = await db.query(
      "SELECT COUNT(DISTINCT customer_id) AS total_customers FROM orders WHERE cafe_id = ? AND DATE(created_at) = ? AND customer_id IS NOT NULL",
      [req.user.cafe_id, targetDate]
    );

    res.json({
      success: true,
      date: targetDate,
      summary: {
        total_sales:      sales[0].total_sales,
        total_bills:      sales[0].total_bills,
        avg_bill:         parseFloat(sales[0].avg_bill).toFixed(2),
        total_kots:       kots[0].total_kots,
        running_tables:   tables[0].running_tables,
        total_collection: collection[0].total_collection,
        total_customers:  customers[0].total_customers,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/reports/sales ───────────────────────────────────────
exports.getSalesTrend = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    let sql, groupBy;

    if (period === 'daily') {
      sql = `SELECT DATE(created_at) AS label, SUM(grand_total) AS total, COUNT(*) AS bills
             FROM bills WHERE cafe_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND status='paid'
             GROUP BY DATE(created_at) ORDER BY label`;
    } else if (period === 'weekly') {
      sql = `SELECT YEARWEEK(created_at, 1) AS label, SUM(grand_total) AS total, COUNT(*) AS bills
             FROM bills WHERE cafe_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK) AND status='paid'
             GROUP BY YEARWEEK(created_at, 1) ORDER BY label`;
    } else if (period === 'monthly') {
      sql = `SELECT DATE_FORMAT(created_at, '%Y-%m') AS label, SUM(grand_total) AS total, COUNT(*) AS bills
             FROM bills WHERE cafe_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH) AND status='paid'
             GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY label`;
    } else {
      sql = `SELECT YEAR(created_at) AS label, SUM(grand_total) AS total, COUNT(*) AS bills
             FROM bills WHERE cafe_id = ? AND status='paid' GROUP BY YEAR(created_at) ORDER BY label`;
    }

    const [rows] = await db.query(sql, [req.user.cafe_id]);
    res.json({ success: true, period, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/reports/top-items ───────────────────────────────────
exports.getTopItems = async (req, res) => {
  try {
    const { date } = req.query;
    let dateFilter = date ? `AND DATE(o.created_at) = '${date}'` : `AND DATE(o.created_at) = CURDATE()`;
    const [rows] = await db.query(`
      SELECT m.name, m.is_veg, c.name AS category,
             SUM(oi.quantity) AS total_qty,
             SUM(oi.quantity * oi.unit_price) AS total_revenue
      FROM order_items oi
      JOIN menu_items m ON m.id = oi.menu_item_id
      JOIN categories c ON c.id = m.category_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.cafe_id = ? AND o.status = 'paid' ${dateFilter}
      GROUP BY oi.menu_item_id
      ORDER BY total_qty DESC LIMIT 10
    `, [req.user.cafe_id]);
    res.json({ success: true, items: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/reports/payment-breakup ────────────────────────────
exports.getPaymentBreakup = async (req, res) => {
  try {
    const { date } = req.query;
    const d = date || new Date().toISOString().split('T')[0];
    const [rows] = await db.query(`
      SELECT method, COUNT(*) AS count, SUM(amount) AS total
      FROM payments
      WHERE cafe_id = ? AND DATE(paid_at) = ? AND status = 'success'
      GROUP BY method
    `, [req.user.cafe_id, d]);
    res.json({ success: true, date: d, breakup: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/reports/category-sales ─────────────────────────────
exports.getCategorySales = async (req, res) => {
  try {
    const { date } = req.query;
    const d = date || new Date().toISOString().split('T')[0];
    const [rows] = await db.query(`
      SELECT c.name AS category, c.color,
             SUM(oi.quantity) AS total_qty,
             SUM(oi.quantity * oi.unit_price) AS total_revenue
      FROM order_items oi
      JOIN menu_items m ON m.id = oi.menu_item_id
      JOIN categories c ON c.id = m.category_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.cafe_id = ? AND o.status = 'paid' AND DATE(o.created_at) = ?
      GROUP BY m.category_id ORDER BY total_revenue DESC
    `, [req.user.cafe_id, d]);
    res.json({ success: true, date: d, categories: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/reports/hourly ──────────────────────────────────────
exports.getHourlySales = async (req, res) => {
  try {
    const { date } = req.query;
    const d = date || new Date().toISOString().split('T')[0];
    const [rows] = await db.query(`
      SELECT HOUR(created_at) AS hour,
             SUM(grand_total) AS total, COUNT(*) AS bills
      FROM bills
      WHERE cafe_id = ? AND DATE(created_at) = ? AND status = 'paid'
      GROUP BY HOUR(created_at) ORDER BY hour
    `, [req.user.cafe_id, d]);
    // Fill missing hours with 0
    const hourly = Array.from({ length: 24 }, (_, h) => {
      const found = rows.find(r => r.hour === h);
      return { hour: h, total: found?.total || 0, bills: found?.bills || 0 };
    });
    res.json({ success: true, date: d, hourly });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/reports/export ──────────────────────────────────────
exports.getExportData = async (req, res) => {
  try {
    const { date } = req.query;
    const d = date || new Date().toISOString().split('T')[0];
    
    // Get cafe info
    const [settings] = await db.query('SELECT name, address, phone, gst_number FROM restaurant_settings WHERE cafe_id = ?', [req.user.cafe_id]);
    
    // Get bills and payments
    const [rows] = await db.query(`
      SELECT 
        b.id,
        CONCAT('POS', LPAD(b.id, 2, '0')) AS invoice_number,
        DATE_FORMAT(b.created_at, '%d-%b-%Y %h:%i %p') AS bill_date,
        (b.subtotal + b.gst_amount + b.service_charge) AS bill_amount,
        b.discount_amount AS discount,
        b.grand_total AS total_amount,
        GROUP_CONCAT(p.method SEPARATOR ', ') AS mode_of_payment
      FROM bills b
      LEFT JOIN payments p ON p.bill_id = b.id AND p.status = 'success'
      WHERE b.cafe_id = ? AND DATE(b.created_at) = ? AND b.status = 'paid'
      GROUP BY b.id
      ORDER BY b.created_at ASC
    `, [req.user.cafe_id, d]);

    const cafe = settings[0] || {};
    
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Report_${d}.pdf`);
    doc.pipe(res);

    // Header section
    doc.fontSize(20).text(cafe.name || 'Cafe', { align: 'center' });
    doc.fontSize(12).text(cafe.address || '', { align: 'center' });
    doc.fontSize(12).text(`Phone: ${cafe.phone || ''} | GST: ${cafe.gst_number || ''}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Report Date: ${d}`, { align: 'center' });
    doc.moveDown();

    const table = {
      title: "Daily Sales Report",
      headers: [
        { label: "S.No", property: "sno", width: 30 },
        { label: "Date", property: "date", width: 110 },
        { label: "Invoice", property: "invoice", width: 60 },
        { label: "Amount", property: "amount", width: 60 },
        { label: "Discount", property: "discount", width: 60 },
        { label: "Total", property: "total", width: 60 },
        { label: "Payment Mode", property: "mode", width: 100 },
      ],
      datas: rows.map((b, i) => ({
        sno: String(i + 1),
        date: b.bill_date,
        invoice: b.invoice_number,
        amount: String(b.bill_amount),
        discount: String(b.discount),
        total: String(b.total_amount),
        mode: b.mode_of_payment || ''
      }))
    };

    await doc.table(table, {
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
      prepareRow: () => doc.font("Helvetica").fontSize(10),
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
