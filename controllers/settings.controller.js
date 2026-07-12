const db = require('../config/db');

exports.getSettings = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM restaurant_settings WHERE cafe_id = ? LIMIT 1', [req.user.cafe_id]);
    res.json({ success: true, settings: rows[0] || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { name, address, phone, email, gst_number, is_gst_enabled, gst_percentage, service_charge_pct, logo_url, receipt_footer, printer_size, upi_id, is_upi_enabled, captain_allow_checkout, captain_allow_print, captain_allow_payment, customer_ordering_enabled, direct_to_kitchen_enabled } = req.body;
    const [existing] = await db.query('SELECT id FROM restaurant_settings WHERE cafe_id = ? LIMIT 1', [req.user.cafe_id]);

    if (existing.length) {
      await db.query(
        `UPDATE restaurant_settings SET name=?,address=?,phone=?,email=?,gst_number=?,
         is_gst_enabled=?,gst_percentage=?,service_charge_pct=?,logo_url=?,receipt_footer=?,printer_size=?,upi_id=?,is_upi_enabled=?,captain_allow_checkout=?,captain_allow_print=?,captain_allow_payment=?,customer_ordering_enabled=?,direct_to_kitchen_enabled=? WHERE cafe_id=?`,
        [name, address, phone, email, gst_number, is_gst_enabled ? 1 : 0, gst_percentage, service_charge_pct, logo_url, receipt_footer, printer_size, upi_id || null, is_upi_enabled ? 1 : 0, captain_allow_checkout ? 1 : 0, captain_allow_print ? 1 : 0, captain_allow_payment ? 1 : 0, customer_ordering_enabled ? 1 : 0, direct_to_kitchen_enabled ? 1 : 0, req.user.cafe_id]
      );
    } else {
      await db.query(
        `INSERT INTO restaurant_settings (cafe_id,name,address,phone,email,gst_number,is_gst_enabled,gst_percentage,service_charge_pct,logo_url,receipt_footer,printer_size,upi_id,is_upi_enabled,captain_allow_checkout,captain_allow_print,captain_allow_payment,customer_ordering_enabled,direct_to_kitchen_enabled)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [req.user.cafe_id, name, address, phone, email, gst_number, is_gst_enabled ? 1 : 0, gst_percentage, service_charge_pct, logo_url, receipt_footer, printer_size, upi_id || null, is_upi_enabled ? 1 : 0, captain_allow_checkout ? 1 : 0, captain_allow_print ? 1 : 0, captain_allow_payment ? 1 : 0, customer_ordering_enabled ? 1 : 0, direct_to_kitchen_enabled ? 1 : 0]
      );
    }
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.uploadLogo = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const host = req.protocol + '://' + req.get('host');
    const logoUrl = host + '/uploads/' + req.file.filename;
    res.json({ success: true, logo_url: logoUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error during upload' });
  }
};
