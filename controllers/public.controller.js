const db = require('../config/db');

exports.getPublicMenu = async (req, res) => {
  try {
    const { cafe_id } = req.params;

    // Fetch cafe details
    const [cafeDetails] = await db.query(
      'SELECT c.id, c.name, c.email, c.phone, c.is_active, rs.address, rs.logo_url, rs.currency, rs.is_gst_enabled, rs.customer_ordering_enabled, rs.direct_to_kitchen_enabled FROM cafes c LEFT JOIN restaurant_settings rs ON c.id = rs.cafe_id WHERE c.id = ? AND c.is_active = 1',
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
        is_gst_enabled: cafe.is_gst_enabled,
        customer_ordering_enabled: !!cafe.customer_ordering_enabled,
        direct_to_kitchen_enabled: !!cafe.direct_to_kitchen_enabled
      },
      categories,
      menuItems
    });
  } catch (err) {
    console.error('Error fetching public menu:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.placeOrder = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { cafe_id } = req.params;
    const { table_id, cartItems } = req.body; // cartItems is array of { menu_item_id, quantity, unit_price }

    if (!table_id || !cartItems || !cartItems.length) {
      return res.status(400).json({ success: false, message: 'Invalid order data' });
    }

    // 1. Get settings
    const [settings] = await connection.query('SELECT direct_to_kitchen_enabled FROM restaurant_settings WHERE cafe_id = ?', [cafe_id]);
    const isDirectToKitchen = settings[0]?.direct_to_kitchen_enabled === 1;

    // 2. Create the Order
    const [orderRes] = await connection.query(
      `INSERT INTO orders (cafe_id, table_id, captain_id, order_type, status, guest_count)
       VALUES (?, ?, NULL, 'dine_in', ?, 1)`,
      [cafe_id, table_id, isDirectToKitchen ? 'kot_sent' : 'open']
    );
    const orderId = orderRes.insertId;

    // 3. Create Order Items
    for (const item of cartItems) {
      await connection.query(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderId, item.menu_item_id, item.quantity, item.unit_price]
      );
    }

    // 4. Create KOT (if direct_to_kitchen_enabled)
    if (isDirectToKitchen) {
      const kotNumber = `KOT-${cafe_id}-${Date.now().toString().slice(-6)}`;
      const [kotRes] = await connection.query(
        `INSERT INTO kots (order_id, table_id, captain_id, kot_number, priority, status)
         VALUES (?, ?, NULL, ?, 'normal', 'pending')`,
        [orderId, table_id, kotNumber]
      );
      const kotId = kotRes.insertId;

      for (const item of cartItems) {
        await connection.query(
          'INSERT INTO kot_items (kot_id, menu_item_id, quantity) VALUES (?, ?, ?)',
          [kotId, item.menu_item_id, item.quantity]
        );
      }
    }

    // 5. Update Table Status
    await connection.query('UPDATE tables SET status = "occupied" WHERE id = ?', [table_id]);

    await connection.commit();
    res.json({ success: true, message: 'Order placed successfully!' });
  } catch (err) {
    await connection.rollback();
    console.error('Error placing order:', err);
    res.status(500).json({ success: false, message: 'Server error placing order' });
  } finally {
    connection.release();
  }
};
