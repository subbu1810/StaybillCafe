-- ═══════════════════════════════════════════════════════════════
--  StayBill Cafe POS — MySQL Database Schema
--  Database: cafe_mobile
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS cafe_mobile
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE cafe_mobile;

-- ──────────────────────────────────────────────────────────────
-- 1. CAFES (Multi-tenant root table)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cafes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  address    TEXT,
  phone      VARCHAR(15) UNIQUE,
  email      VARCHAR(100) UNIQUE,
  gst_number VARCHAR(25) UNIQUE,
  plan       ENUM('trial','basic','pro') NOT NULL DEFAULT 'trial',
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 2. USERS (Auth + Roles)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  cafe_id       INT           NULL,  -- NULL for superadmin
  name          VARCHAR(100)  NOT NULL,
  username      VARCHAR(50)   NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('superadmin','admin','captain','cashier','kitchen') NOT NULL,
  phone         VARCHAR(15),
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 3. RESTAURANT SETTINGS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_settings (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  cafe_id             INT          NOT NULL UNIQUE,
  name                VARCHAR(200) NOT NULL DEFAULT 'StayBill Cafe',
  address             TEXT,
  phone               VARCHAR(15),
  email               VARCHAR(100),
  gst_number          VARCHAR(25),
  gst_percentage      DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  service_charge_pct  DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  logo_url            VARCHAR(500),
  currency            VARCHAR(5)   NOT NULL DEFAULT 'INR',
  timezone            VARCHAR(50)  NOT NULL DEFAULT 'Asia/Kolkata',
  receipt_footer      TEXT,
  is_gst_enabled      TINYINT(1)   NOT NULL DEFAULT 0,
  printer_size        VARCHAR(10)  NOT NULL DEFAULT '58mm',
  upi_id              VARCHAR(50)  DEFAULT NULL,
  is_upi_enabled      TINYINT(1)   NOT NULL DEFAULT 0,
  captain_allow_checkout TINYINT(1) NOT NULL DEFAULT 0,
  captain_allow_print    TINYINT(1) NOT NULL DEFAULT 0,
  captain_allow_payment  TINYINT(1) NOT NULL DEFAULT 0,
  updated_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 4. MENU CATEGORIES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  cafe_id    INT          NOT NULL,
  name       VARCHAR(100) NOT NULL,
  icon       VARCHAR(100),
  color      VARCHAR(20),
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 5. MENU ITEMS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  cafe_id      INT            NOT NULL,
  category_id  INT            NOT NULL,
  name         VARCHAR(200)   NOT NULL,
  description  TEXT,
  price        DECIMAL(10,2)  NOT NULL,
  image_url    VARCHAR(500),
  is_available TINYINT(1)     NOT NULL DEFAULT 1,
  is_veg       TINYINT(1)     NOT NULL DEFAULT 1,
  created_at   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cafe_id)      REFERENCES cafes(id)      ON DELETE CASCADE,
  FOREIGN KEY (category_id)  REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 6. TABLE SECTIONS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sections (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  cafe_id INT          NOT NULL,
  name    VARCHAR(100) NOT NULL,
  FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 7. RESTAURANT TABLES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tables (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  cafe_id      INT         NOT NULL,
  section_id   INT,
  table_number VARCHAR(20) NOT NULL,
  capacity     INT         NOT NULL DEFAULT 4,
  status       ENUM('available','occupied','reserved','billing','cleaning') NOT NULL DEFAULT 'available',
  updated_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cafe_id)    REFERENCES cafes(id)    ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 8. CUSTOMERS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  cafe_id        INT          NOT NULL,
  name           VARCHAR(100) NOT NULL,
  mobile         VARCHAR(15)  NOT NULL,
  email          VARCHAR(100),
  birthday       DATE,
  total_visits   INT          NOT NULL DEFAULT 0,
  loyalty_points INT          NOT NULL DEFAULT 0,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_mobile_per_cafe (cafe_id, mobile),
  FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 9. ORDERS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  cafe_id     INT     NOT NULL,
  table_id    INT     NULL,
  captain_id  INT     NOT NULL,
  customer_id INT,
  order_type  ENUM('dine_in','takeaway') NOT NULL DEFAULT 'dine_in',
  status      ENUM('open','kot_sent','billing','paid','cancelled') NOT NULL DEFAULT 'open',
  guest_count INT     NOT NULL DEFAULT 1,
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cafe_id)     REFERENCES cafes(id)     ON DELETE CASCADE,
  FOREIGN KEY (table_id)    REFERENCES tables(id)    ON DELETE RESTRICT,
  FOREIGN KEY (captain_id)  REFERENCES users(id)     ON DELETE RESTRICT,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 9. ORDER ITEMS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  order_id             INT           NOT NULL,
  menu_item_id         INT           NOT NULL,
  quantity             INT           NOT NULL DEFAULT 1,
  unit_price           DECIMAL(10,2) NOT NULL,
  special_instructions TEXT,
  FOREIGN KEY (order_id)     REFERENCES orders(id)     ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 10. KOTs (Kitchen Order Tickets)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kots (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT  NOT NULL,
  table_id    INT  NULL,
  captain_id  INT  NOT NULL,
  kot_number  VARCHAR(30) NOT NULL UNIQUE,
  priority    ENUM('normal','high','urgent') NOT NULL DEFAULT 'normal',
  status      ENUM('pending','preparing','ready','served') NOT NULL DEFAULT 'pending',
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id)   REFERENCES orders(id)  ON DELETE CASCADE,
  FOREIGN KEY (table_id)   REFERENCES tables(id)  ON DELETE RESTRICT,
  FOREIGN KEY (captain_id) REFERENCES users(id)   ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 11. KOT ITEMS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kot_items (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  kot_id               INT NOT NULL,
  menu_item_id         INT NOT NULL,
  quantity             INT NOT NULL DEFAULT 1,
  special_instructions TEXT,
  FOREIGN KEY (kot_id)       REFERENCES kots(id)       ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 13. BILLS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bills (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  cafe_id             INT           NOT NULL,
  order_id            INT           NOT NULL,
  table_id            INT           NULL,
  cashier_id          INT           NOT NULL,
  bill_number         VARCHAR(30)   NOT NULL,
  subtotal            DECIMAL(10,2) NOT NULL DEFAULT 0,
  gst_percentage      DECIMAL(5,2)  NOT NULL DEFAULT 5.00,
  gst_amount          DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_type       ENUM('percentage','flat') NOT NULL DEFAULT 'flat',
  discount_value      DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
  service_charge_pct  DECIMAL(5,2)  NOT NULL DEFAULT 0,
  service_charge      DECIMAL(10,2) NOT NULL DEFAULT 0,
  grand_total         DECIMAL(10,2) NOT NULL DEFAULT 0,
  status              ENUM('draft','printed','paid','cancelled') NOT NULL DEFAULT 'draft',
  created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_bill_per_cafe (cafe_id, bill_number),
  FOREIGN KEY (cafe_id)    REFERENCES cafes(id)  ON DELETE CASCADE,
  FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE RESTRICT,
  FOREIGN KEY (table_id)   REFERENCES tables(id) ON DELETE RESTRICT,
  FOREIGN KEY (cashier_id) REFERENCES users(id)  ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 13. PAYMENTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  bill_id         INT           NOT NULL,
  method          ENUM('cash','upi','card','wallet','split') NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  transaction_ref VARCHAR(100),
  status          ENUM('pending','success','failed') NOT NULL DEFAULT 'success',
  paid_at         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 14. SUBSCRIPTIONS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cafe_id INT NOT NULL,
  plan_duration INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  razorpay_signature VARCHAR(255),
  status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 15. INVENTORY
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  cafe_id       INT           NOT NULL,
  name          VARCHAR(200)  NOT NULL,
  unit          VARCHAR(50),
  quantity      DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_quantity  DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0,
  category      VARCHAR(100),
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 15B. MENU ITEM INGREDIENTS (RECIPES)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id        INT           NOT NULL,
  inventory_id        INT           NOT NULL,
  quantity_required   DECIMAL(10,2) NOT NULL DEFAULT 1,
  created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 16. EXPENSES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  cafe_id        INT           NOT NULL,
  category       VARCHAR(100)  NOT NULL,
  description    TEXT,
  amount         DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash','upi','card') NOT NULL DEFAULT 'cash',
  expense_date   DATE          NOT NULL,
  created_by     INT,
  created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cafe_id)    REFERENCES cafes(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- 17. EMPLOYEES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  cafe_id      INT           NOT NULL,
  user_id      INT,
  name         VARCHAR(100)  NOT NULL,
  role         VARCHAR(50),
  phone        VARCHAR(15),
  email        VARCHAR(100),
  salary       DECIMAL(10,2),
  joining_date DATE,
  is_active    TINYINT(1)    NOT NULL DEFAULT 1,
  created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────────────────────
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_cafe     ON menu_items(cafe_id);
CREATE INDEX idx_tables_status       ON tables(status);
CREATE INDEX idx_tables_cafe         ON tables(cafe_id);
CREATE INDEX idx_orders_table        ON orders(table_id);
CREATE INDEX idx_orders_status       ON orders(status);
CREATE INDEX idx_orders_cafe         ON orders(cafe_id);
CREATE INDEX idx_kots_status         ON kots(status);
CREATE INDEX idx_kots_order          ON kots(order_id);
CREATE INDEX idx_bills_order         ON bills(order_id);
CREATE INDEX idx_bills_status        ON bills(status);
CREATE INDEX idx_bills_cafe          ON bills(cafe_id);
CREATE INDEX idx_payments_bill       ON payments(bill_id);
CREATE INDEX idx_expenses_date       ON expenses(expense_date);
CREATE INDEX idx_expenses_cafe       ON expenses(cafe_id);
