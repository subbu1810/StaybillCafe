const db = require('../config/db');



// ── POST /api/bills ─────────────────────────────────────────────
exports.generateBill = async (req, res) => {
  try {
    const { order_id, discount_type, discount_value } = req.body;
    if (!order_id) return res.status(400).json({ success: false, message: 'order_id required' });

    // Get order items
    const [items] = await db.query(
      `SELECT oi.*, m.name AS item_name
       FROM order_items oi 
       JOIN menu_items m ON m.id = oi.menu_item_id 
       JOIN categories c ON c.id = m.category_id 
       WHERE oi.order_id = ?`,
      [order_id]
    );
    if (!items.length) return res.status(400).json({ success: false, message: 'No items in order' });

    const [orders] = await db.query('SELECT * FROM orders WHERE id = ? AND cafe_id = ?', [order_id, req.user.cafe_id]);
    if (!orders.length) return res.status(404).json({ success: false, message: 'Order not found' });

    // Get restaurant settings
    const [settings] = await db.query('SELECT * FROM restaurant_settings WHERE cafe_id = ? LIMIT 1', [req.user.cafe_id]);
    const isGstEnabled = settings[0]?.is_gst_enabled == 1;
    const svcPct = settings[0]?.service_charge_pct || 0;

    let subtotal = 0;
    let gstAmount = 0;
    const globalGstPct = parseFloat(settings[0]?.gst_percentage) || 5;

    items.forEach(i => {
      const itemTotal = i.quantity * i.unit_price;
      subtotal += itemTotal;
      if (isGstEnabled) {
        const itemGstPct = parseFloat(i.cat_gst) || globalGstPct;
        gstAmount += (itemTotal * itemGstPct) / 100;
      }
    });
    
    // Store the global GST pct so the frontend can split it into CGST/SGST easily
    const gstPctToStore = isGstEnabled ? globalGstPct : 0;
    const svcCharge = (subtotal * svcPct) / 100;

    let discountAmt = 0;
    const dtype = discount_type || 'flat';
    const dval = parseFloat(discount_value) || 0;
    if (dtype === 'percentage') discountAmt = (subtotal * dval) / 100;
    else discountAmt = dval;

    const grandTotal = subtotal + gstAmount + svcCharge - discountAmt;

    const [existing] = await db.query('SELECT id, status FROM bills WHERE order_id = ? AND status != ? AND cafe_id = ?', [order_id, 'cancelled', req.user.cafe_id]);
    if (existing.length) {
      if (existing[0].status === 'paid') {
         return res.status(400).json({ success: false, message: 'Bill already paid' });
      }
      
      // Update existing bill with new totals
      await db.query(
        `UPDATE bills SET subtotal=?, gst_percentage=?, gst_amount=?, discount_type=?, discount_value=?, discount_amount=?, service_charge_pct=?, service_charge=?, grand_total=? WHERE id=?`,
        [subtotal, gstPctToStore, gstAmount, dtype, dval, discountAmt, svcPct, svcCharge, grandTotal, existing[0].id]
      );
      
      return res.status(200).json({ 
        success: true, 
        message: 'Bill updated', 
        billId: existing[0].id,
        summary: { subtotal, gstAmount, svcCharge, discountAmt, grandTotal } 
      });
    }

    let billNumber = '';
    if (isGstEnabled) {
      const [invCount] = await db.query('SELECT COUNT(*) as count FROM bills WHERE cafe_id = ? AND bill_number LIKE "POSINV%"', [req.user.cafe_id]);
      billNumber = `POSINV${String(invCount[0].count + 1).padStart(2, '0')}`;
    } else {
      const [billCount] = await db.query('SELECT COUNT(*) as count FROM bills WHERE cafe_id = ? AND bill_number NOT LIKE "POSINV%"', [req.user.cafe_id]);
      billNumber = String(billCount[0].count + 1).padStart(2, '0');
    }

    const [result] = await db.query(
      `INSERT INTO bills (cafe_id, order_id, table_id, cashier_id, bill_number, subtotal, gst_percentage, gst_amount,
        discount_type, discount_value, discount_amount, service_charge_pct, service_charge, grand_total)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.cafe_id, order_id, orders[0].table_id, req.user.id, billNumber,
       subtotal, gstPctToStore, gstAmount, dtype, dval, discountAmt, svcPct, svcCharge, grandTotal]
    );

    // Deduct inventory stock
    try {
      const menu_item_ids = items.map(i => i.menu_item_id);
      if (menu_item_ids.length > 0) {
        const [ingredients] = await db.query(
          `SELECT mii.menu_item_id, mii.inventory_id, mii.quantity_required 
           FROM menu_item_ingredients mii 
           WHERE mii.menu_item_id IN (?)`,
          [menu_item_ids]
        );
        
        if (ingredients.length > 0) {
          const deductions = {};
          items.forEach(orderItem => {
             const recipe = ingredients.filter(ing => ing.menu_item_id === orderItem.menu_item_id);
             recipe.forEach(ing => {
                const totalDeduct = ing.quantity_required * orderItem.quantity;
                if (!deductions[ing.inventory_id]) {
                   deductions[ing.inventory_id] = 0;
                }
                deductions[ing.inventory_id] += totalDeduct;
             });
          });

          for (const [invId, amount] of Object.entries(deductions)) {
             await db.query(
               `UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND cafe_id = ?`,
               [amount, invId, req.user.cafe_id]
             );
          }
        }
      }
    } catch (invErr) {
      console.error('Inventory deduction error:', invErr);
    }

    await db.query("UPDATE orders SET status = 'billing' WHERE id = ? AND cafe_id = ?", [order_id, req.user.cafe_id]);
    const io = req.app.get('io');
    if (orders[0].table_id) {
      await db.query("UPDATE tables SET status = 'billing' WHERE id = ? AND cafe_id = ?", [orders[0].table_id, req.user.cafe_id]);
      if (io) {
        io.emit('table_updated', { table_id: orders[0].table_id, status: 'billing' });
      }
    }
    if (io) io.emit('order_updated', { order_id, status: 'billing' });

    res.status(201).json({
      success: true, billId: result.insertId,
      summary: { subtotal, gstAmount, svcCharge, discountAmt, grandTotal }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/bills ──────────────────────────────────────────────
exports.getBills = async (req, res) => {
  try {
    const { date, status } = req.query;
    let sql = `
      SELECT b.*, t.table_number, u.name AS cashier_name,
             o.captain_id, cap.name AS captain_name
      FROM bills b
      LEFT JOIN tables t ON t.id = b.table_id
      JOIN users u ON u.id = b.cashier_id
      JOIN orders o ON o.id = b.order_id
      LEFT JOIN users cap ON cap.id = o.captain_id
      WHERE b.cafe_id = ?
    `;
    const params = [req.user.cafe_id];
    if (date) { sql += ' AND DATE(b.created_at) = ?'; params.push(date); }
    else       { sql += ' AND DATE(b.created_at) = CURDATE()'; }
    if (status){ sql += ' AND b.status = ?'; params.push(status); }
    sql += ' ORDER BY b.created_at DESC';

    const [rows] = await db.query(sql, params);
    res.json({ success: true, bills: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/bills/:id ──────────────────────────────────────────
exports.getBill = async (req, res) => {
  try {
    const [bills] = await db.query(`
      SELECT b.*, t.table_number, s.name AS section,
             u.name AS cashier_name, cap.name AS captain_name,
             rs.name AS restaurant_name, rs.address, rs.gst_number, rs.phone AS restaurant_phone,
             rs.upi_id, rs.is_upi_enabled
      FROM bills b
      LEFT JOIN tables t ON t.id = b.table_id
      LEFT JOIN sections s ON s.id = t.section_id
      JOIN users u ON u.id = b.cashier_id
      JOIN orders o ON o.id = b.order_id
      LEFT JOIN users cap ON cap.id = o.captain_id
      LEFT JOIN restaurant_settings rs ON rs.cafe_id = b.cafe_id
      WHERE b.id = ? AND b.cafe_id = ?
    `, [req.params.id, req.user.cafe_id]);
    if (!bills.length) return res.status(404).json({ success: false, message: 'Bill not found' });

    const [items] = await db.query(`
      SELECT oi.*, m.name AS item_name, m.is_veg, cat.name AS category
      FROM order_items oi
      JOIN menu_items m ON m.id = oi.menu_item_id
      JOIN categories cat ON cat.id = m.category_id
      WHERE oi.order_id = ?
    `, [bills[0].order_id]);

    res.json({ success: true, bill: bills[0], items });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/bills/:id/discount ─────────────────────────────────
exports.applyDiscount = async (req, res) => {
  try {
    const { discount_type, discount_value } = req.body;
    const [bills] = await db.query('SELECT * FROM bills WHERE id = ? AND cafe_id = ?', [req.params.id, req.user.cafe_id]);
    if (!bills.length) return res.status(404).json({ success: false, message: 'Bill not found' });

    const b = bills[0];
    let discountAmt = 0;
    if (discount_type === 'percentage') discountAmt = (Number(b.subtotal) * discount_value) / 100;
    else discountAmt = parseFloat(discount_value);

    const grandTotal = Number(b.subtotal) + Number(b.gst_amount) + Number(b.service_charge) - discountAmt;
    await db.query(
      'UPDATE bills SET discount_type=?, discount_value=?, discount_amount=?, grand_total=? WHERE id=? AND cafe_id=?',
      [discount_type, discount_value, discountAmt, grandTotal, req.params.id, req.user.cafe_id]
    );
    res.json({ success: true, discountAmt, grandTotal });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/bills/:id/status ───────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE bills SET status=? WHERE id=? AND cafe_id=?', [status, req.params.id, req.user.cafe_id]);
    res.json({ success: true, message: `Bill ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
