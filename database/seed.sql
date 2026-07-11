-- ═══════════════════════════════════════════════════════════════
--  StayBill Cafe POS — Seed Data
--  Run AFTER schema.sql
-- ═══════════════════════════════════════════════════════════════
USE staybillcafe;

-- ── Cafes ───────────────────────────────────────────────────────
INSERT INTO cafes (id, name, address, phone, email, gst_number, plan, is_active) 
VALUES (1, 'StayBill Cafe', '123 MG Road, Bengaluru, Karnataka 560001', '+91-9876543210', 'info@staybillcafe.com', '29AABCS1429B1Z1', 'pro', 1);

-- ── Restaurant Settings ─────────────────────────────────────────
INSERT INTO restaurant_settings (cafe_id, name, address, phone, email, gst_number, gst_percentage, service_charge_pct, currency)
VALUES (1, 'StayBill Cafe', '123 MG Road, Bengaluru, Karnataka 560001', '+91-9876543210',
        'info@staybillcafe.com', '29AABCS1429B1Z1', 5.00, 2.00, 'INR');

-- ── Users (password: admin123 / captain123 / cashier123 / kitchen123) ──
-- All passwords hashed with bcrypt rounds=10
INSERT INTO users (cafe_id, name, username, password_hash, role, phone) VALUES
(1, 'Rajan Kumar',   'admin',   '$2a$10$xEfH15LLXLcmJ5R/dxI65.C/.IFMKWMHuaAVXxw5JNi3Pz1gZOZIS', 'admin',   '+91-9000000001'),
(1, 'Arjun Sharma',  'captain1','$2a$10$xEfH15LLXLcmJ5R/dxI65.C/.IFMKWMHuaAVXxw5JNi3Pz1gZOZIS', 'captain', '+91-9000000002'),
(1, 'Priya Nair',    'captain2','$2a$10$xEfH15LLXLcmJ5R/dxI65.C/.IFMKWMHuaAVXxw5JNi3Pz1gZOZIS', 'captain', '+91-9000000003'),
(1, 'Suresh Babu',   'cashier1','$2a$10$xEfH15LLXLcmJ5R/dxI65.C/.IFMKWMHuaAVXxw5JNi3Pz1gZOZIS', 'cashier', '+91-9000000004'),
(1, 'Meena Pillai',  'cashier2','$2a$10$xEfH15LLXLcmJ5R/dxI65.C/.IFMKWMHuaAVXxw5JNi3Pz1gZOZIS', 'cashier', '+91-9000000005'),
(1, 'Chef Ramesh',   'kitchen1','$2a$10$xEfH15LLXLcmJ5R/dxI65.C/.IFMKWMHuaAVXxw5JNi3Pz1gZOZIS', 'kitchen', '+91-9000000006');

-- ── Note: Plain passwords for seed users ──
-- admin/captain1/captain2/cashier1/cashier2/kitchen1 all use password: "password123"
-- (hash above is for "password123" — update as needed via /api/auth/change-password)

-- ── Menu Categories ─────────────────────────────────────────────
INSERT INTO categories (cafe_id, name, icon, color, sort_order) VALUES
(1, 'Coffee',     'coffee',         '#6D28D9', 1),
(1, 'Tea',        'tea',            '#F97316', 2),
(1, 'Burgers',    'hamburger',      '#EF4444', 3),
(1, 'Pizza',      'pizza',          '#F59E0B', 4),
(1, 'Desserts',   'cake',           '#EC4899', 5),
(1, 'Beverages',  'cup',            '#22C55E', 6),
(1, 'Snacks',     'french-fries',   '#3B82F6', 7),
(1, 'Breakfast',  'egg-fried-rice', '#14B8A6', 8);

-- ── Menu Items ──────────────────────────────────────────────────
INSERT INTO menu_items (cafe_id, category_id, name, description, price, is_available, is_veg) VALUES
-- Coffee (cat 1)
(1, 1, 'Espresso',          'Rich single shot espresso',                         80,  1, 1),
(1, 1, 'Cappuccino',        'Classic Italian cappuccino with foam',              120,  1, 1),
(1, 1, 'Latte',             'Smooth espresso with steamed milk',                 130,  1, 1),
(1, 1, 'Cold Brew',         '12-hour cold steeped coffee',                       150,  1, 1),
(1, 1, 'Americano',         'Espresso with hot water',                            90,  1, 1),
(1, 1, 'Mocha',             'Chocolate flavored espresso drink',                 140,  1, 1),
-- Tea (cat 2)
(1, 2, 'Masala Chai',       'Spiced Indian tea with milk',                        60,  1, 1),
(1, 2, 'Green Tea',         'Refreshing hot green tea',                           70,  1, 1),
(1, 2, 'Lemon Tea',         'Hot tea with lemon and honey',                       70,  1, 1),
(1, 2, 'Kashmiri Kahwa',    'Saffron infused Kashmiri green tea',                100,  1, 1),
-- Burgers (cat 3)
(1, 3, 'Veg Burger',        'Crispy veggie patty with fresh veggies',            160,  1, 1),
(1, 3, 'Chicken Burger',    'Juicy grilled chicken with chipotle sauce',         220,  1, 0),
(1, 3, 'Double Smash',      'Double smash patty with cheese',                    280,  1, 0),
(1, 3, 'Paneer Burger',     'Spiced paneer tikka patty',                         190,  1, 1),
-- Pizza (cat 4)
(1, 4, 'Margherita',        'Classic tomato, mozzarella, basil',                 220,  1, 1),
(1, 4, 'Pepperoni',         'Loaded pepperoni on cheese base',                   320,  1, 0),
(1, 4, 'BBQ Chicken',       'Smoky BBQ chicken with peppers',                    350,  1, 0),
(1, 4, 'Paneer Tikka Pizza','Spiced paneer with Indian herbs',                   280,  1, 1),
-- Desserts (cat 5)
(1, 5, 'Chocolate Brownie', 'Warm fudgy brownie with ice cream',                 180,  1, 1),
(1, 5, 'Cheesecake',        'New York style baked cheesecake',                   200,  1, 1),
(1, 5, 'Gulab Jamun',       'Soft dumplings in rose sugar syrup',                100,  1, 1),
(1, 5, 'Ice Cream Sundae',  'Three scoops with toppings',                        160,  1, 1),
-- Beverages (cat 6)
(1, 6, 'Fresh Lime Soda',   'Chilled lime with soda and mint',                    80,  1, 1),
(1, 6, 'Mango Lassi',       'Thick mango yogurt drink',                          110,  1, 1),
(1, 6, 'Virgin Mojito',     'Mint, lime, soda refresher',                        100,  1, 1),
(1, 6, 'Orange Juice',      'Fresh squeezed orange juice',                        90,  1, 1),
-- Snacks (cat 7)
(1, 7, 'Samosa (2pcs)',     'Crispy potato filled pastry',                        60,  1, 1),
(1, 7, 'French Fries',      'Golden salted crispy fries',                         90,  1, 1),
(1, 7, 'Nachos & Dip',      'Tortilla chips with salsa and guac',                130,  1, 1),
(1, 7, 'Onion Rings',       'Beer battered crispy rings',                        100,  1, 1),
-- Breakfast (cat 8)
(1, 8, 'Masala Omelette',   'Spiced three egg omelette',                         120,  1, 0),
(1, 8, 'Avocado Toast',     'Sourdough with smashed avocado',                    160,  1, 1),
(1, 8, 'Pancakes (3pcs)',   'Fluffy pancakes with maple syrup',                  140,  1, 1),
(1, 8, 'Poha',              'Flattened rice with veggies & peanuts',              80,  1, 1);

-- ── Sections ────────────────────────────────────────────────────
INSERT INTO sections (cafe_id, name) VALUES
(1, 'Indoor'), (1, 'Outdoor'), (1, 'VIP'), (1, 'Terrace');

-- ── Tables ──────────────────────────────────────────────────────
INSERT INTO tables (cafe_id, section_id, table_number, capacity, status) VALUES
-- Indoor (section 1)
(1, 1, 'T01', 4, 'available'), (1, 1, 'T02', 4, 'occupied'),
(1, 1, 'T03', 2, 'available'), (1, 1, 'T04', 6, 'reserved'),
(1, 1, 'T05', 4, 'available'), (1, 1, 'T06', 4, 'billing'),
(1, 1, 'T07', 2, 'available'), (1, 1, 'T08', 8, 'cleaning'),
-- Outdoor (section 2)
(1, 2, 'O01', 4, 'available'), (1, 2, 'O02', 4, 'occupied'),
(1, 2, 'O03', 6, 'available'), (1, 2, 'O04', 4, 'reserved'),
-- VIP (section 3)
(1, 3, 'V01', 8, 'available'), (1, 3, 'V02', 10,'occupied'),
(1, 3, 'V03', 6, 'available'),
-- Terrace (section 4)
(1, 4, 'TR1', 4, 'available'), (1, 4, 'TR2', 4, 'available'),
(1, 4, 'TR3', 6, 'occupied'),  (1, 4, 'TR4', 4, 'available'),
(1, 4, 'TR5', 2, 'cleaning');

-- ── Customers ───────────────────────────────────────────────────
INSERT INTO customers (cafe_id, name, mobile, email, birthday, total_visits, loyalty_points) VALUES
(1, 'Aditya Mehta',   '9811122233', 'aditya@email.com',  '1990-03-15', 12, 240),
(1, 'Sneha Gupta',    '9822233344', 'sneha@email.com',   '1995-07-22', 8,  160),
(1, 'Rahul Singh',    '9833344455', 'rahul@email.com',   '1988-11-01', 25, 500),
(1, 'Kavita Reddy',   '9844455566', 'kavita@email.com',  '1992-05-30', 5,   100),
(1, 'Mohammed Ali',   '9855566677', 'mali@email.com',    '1985-01-18', 3,    60);

-- ── Employees ───────────────────────────────────────────────────
INSERT INTO employees (cafe_id, name, role, phone, email, salary, joining_date) VALUES
(1, 'Rajan Kumar',  'Manager',     '+91-9000000001', 'rajan@staybill.com',  45000, '2022-01-10'),
(1, 'Arjun Sharma', 'Captain',     '+91-9000000002', 'arjun@staybill.com',  25000, '2022-06-15'),
(1, 'Priya Nair',   'Captain',     '+91-9000000003', 'priya@staybill.com',  25000, '2023-02-01'),
(1, 'Suresh Babu',  'Cashier',     '+91-9000000004', 'suresh@staybill.com', 22000, '2022-09-01'),
(1, 'Meena Pillai', 'Cashier',     '+91-9000000005', 'meena@staybill.com',  22000, '2023-04-15'),
(1, 'Chef Ramesh',  'Head Chef',   '+91-9000000006', 'ramesh@staybill.com', 35000, '2022-01-10');

-- ── Inventory ───────────────────────────────────────────────────
INSERT INTO inventory (cafe_id, name, unit, quantity, min_quantity, cost_per_unit, category) VALUES
(1, 'Coffee Beans',     'kg',    15.5, 5.0,  800.00, 'Beverages'),
(1, 'Milk',             'litre', 30.0, 10.0,  60.00, 'Dairy'),
(1, 'Sugar',            'kg',    20.0, 5.0,   45.00, 'Pantry'),
(1, 'All Purpose Flour','kg',    25.0, 8.0,   55.00, 'Pantry'),
(1, 'Chicken Breast',   'kg',    10.0, 3.0,  280.00, 'Proteins'),
(1, 'Cheese (Mozzarella)', 'kg',  8.0, 2.0,  450.00, 'Dairy'),
(1, 'Tomatoes',         'kg',    12.0, 4.0,   40.00, 'Vegetables'),
(1, 'Onions',           'kg',    15.0, 5.0,   25.00, 'Vegetables'),
(1, 'Butter',           'kg',     5.0, 1.5,  420.00, 'Dairy'),
(1, 'Cooking Oil',      'litre', 10.0, 3.0,  180.00, 'Pantry');
