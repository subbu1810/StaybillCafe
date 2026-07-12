const db = require('../config/db');

exports.getPublicMenu = async (req, res) => {
  try {
    const { cafe_id } = req.params;

    // Fetch cafe details
    const [cafeDetails] = await db.query(
      'SELECT c.id, c.name, c.email, c.phone, c.status, rs.address, rs.logo_url, rs.currency, rs.is_gst_enabled FROM cafes c LEFT JOIN restaurant_settings rs ON c.id = rs.cafe_id WHERE c.id = ? AND c.status = "active"',
      [cafe_id]
    );

    if (!cafeDetails.length) {
      return res.status(404).json({ success: false, message: 'Cafe not found or inactive' });
    }

    const cafe = cafeDetails[0];

    // Fetch active categories
    const [categories] = await db.query(
      'SELECT id, name, icon, color, sort_order FROM categories WHERE cafe_id = ? AND is_active = 1 ORDER BY sort_order, name',
      [cafe_id]
    );

    // Fetch active menu items
    const [menuItems] = await db.query(
      'SELECT id, category_id, name, description, price, image_url, is_veg FROM menu_items WHERE cafe_id = ? AND is_available = 1 ORDER BY name',
      [cafe_id]
    );

    res.json({
      success: true,
      cafe: {
        id: cafe.id,
        name: cafe.name,
        email: cafe.email,
        phone: cafe.phone,
        address: cafe.address,
        logo_url: cafe.logo_url,
        currency: cafe.currency,
        is_gst_enabled: cafe.is_gst_enabled
      },
      categories,
      menuItems
    });
  } catch (err) {
    console.error('Error fetching public menu:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
