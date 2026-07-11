-- ═══════════════════════════════════════════════════════════════
--  StayBill POS — Multi-Tenant Migration Script (MySQL Compatible)
--  Run ONCE on existing databases to add cafe_id to all tables.
-- ═══════════════════════════════════════════════════════════════

USE cafe_mobile;

-- ── Step 1: Create cafes table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS cafes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  address    TEXT,
  phone      VARCHAR(15),
  email      VARCHAR(100),
  gst_number VARCHAR(25),
  plan       ENUM('trial','basic','pro') NOT NULL DEFAULT 'trial',
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Step 2: Seed the first cafe ──────────────────────────────────
INSERT INTO cafes (name, address, phone, email, gst_number)
SELECT name, address, phone, email, gst_number
FROM restaurant_settings LIMIT 1;

-- Fallback if restaurant_settings is empty
INSERT INTO cafes (name)
SELECT 'My Cafe' WHERE NOT EXISTS (SELECT 1 FROM cafes LIMIT 1);

-- ── Step 3: Add cafe_id columns via stored procedure ─────────────

DROP PROCEDURE IF EXISTS add_col_if_missing;
DELIMITER $$
CREATE PROCEDURE add_col_if_missing(
  IN tbl VARCHAR(64),
  IN col VARCHAR(64),
  IN col_def TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = tbl AND column_name = col
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', col_def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$
DELIMITER ;

-- users
CALL add_col_if_missing('users', 'cafe_id', 'INT NULL AFTER id');

-- restaurant_settings
CALL add_col_if_missing('restaurant_settings', 'cafe_id', 'INT NULL AFTER id');

-- categories
CALL add_col_if_missing('categories', 'cafe_id', 'INT NOT NULL DEFAULT 1 AFTER id');

-- menu_items
CALL add_col_if_missing('menu_items', 'cafe_id', 'INT NOT NULL DEFAULT 1 AFTER id');

-- sections
CALL add_col_if_missing('sections', 'cafe_id', 'INT NOT NULL DEFAULT 1 AFTER id');

-- tables
CALL add_col_if_missing('tables', 'cafe_id', 'INT NOT NULL DEFAULT 1 AFTER id');

-- customers
CALL add_col_if_missing('customers', 'cafe_id', 'INT NOT NULL DEFAULT 1 AFTER id');

-- orders
CALL add_col_if_missing('orders', 'cafe_id', 'INT NOT NULL DEFAULT 1 AFTER id');

-- bills
CALL add_col_if_missing('bills', 'cafe_id', 'INT NOT NULL DEFAULT 1 AFTER id');

-- inventory
CALL add_col_if_missing('inventory', 'cafe_id', 'INT NOT NULL DEFAULT 1 AFTER id');

-- expenses
CALL add_col_if_missing('expenses', 'cafe_id', 'INT NOT NULL DEFAULT 1 AFTER id');

-- employees
CALL add_col_if_missing('employees', 'cafe_id', 'INT NOT NULL DEFAULT 1 AFTER id');

DROP PROCEDURE IF EXISTS add_col_if_missing;

-- ── Step 4: Update users role ENUM ───────────────────────────────
ALTER TABLE users MODIFY COLUMN role ENUM('superadmin','admin','captain','cashier','kitchen') NOT NULL;

-- ── Step 5: Stamp all existing rows with cafe_id = 1 ─────────────
UPDATE users               SET cafe_id = 1 WHERE cafe_id IS NULL;
UPDATE restaurant_settings SET cafe_id = 1 WHERE cafe_id IS NULL;
UPDATE categories          SET cafe_id = 1 WHERE cafe_id = 0 OR cafe_id IS NULL;
UPDATE menu_items          SET cafe_id = 1 WHERE cafe_id = 0 OR cafe_id IS NULL;
UPDATE sections            SET cafe_id = 1 WHERE cafe_id = 0 OR cafe_id IS NULL;
UPDATE `tables`            SET cafe_id = 1 WHERE cafe_id = 0 OR cafe_id IS NULL;
UPDATE customers           SET cafe_id = 1 WHERE cafe_id = 0 OR cafe_id IS NULL;
UPDATE orders              SET cafe_id = 1 WHERE cafe_id = 0 OR cafe_id IS NULL;
UPDATE bills               SET cafe_id = 1 WHERE cafe_id = 0 OR cafe_id IS NULL;
UPDATE inventory           SET cafe_id = 1 WHERE cafe_id = 0 OR cafe_id IS NULL;
UPDATE expenses            SET cafe_id = 1 WHERE cafe_id = 0 OR cafe_id IS NULL;
UPDATE employees           SET cafe_id = 1 WHERE cafe_id = 0 OR cafe_id IS NULL;

-- ── Step 6: Fix unique constraints (safe via procedure) ─────────
DROP PROCEDURE IF EXISTS drop_index_if_exists;
DELIMITER $$
CREATE PROCEDURE drop_index_if_exists(IN tbl VARCHAR(64), IN idx VARCHAR(64))
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = tbl AND index_name = idx
  ) THEN
    SET @sql2 = CONCAT('ALTER TABLE `', tbl, '` DROP INDEX `', idx, '`');
    PREPARE stmt2 FROM @sql2;
    EXECUTE stmt2;
    DEALLOCATE PREPARE stmt2;
  END IF;
 END $$
DELIMITER ;

CALL drop_index_if_exists('customers', 'mobile');
CALL drop_index_if_exists('bills', 'bill_number');
DROP PROCEDURE IF EXISTS drop_index_if_exists;

-- ── Step 8: Create the superadmin user (password: Admin@123) ─────
-- Hash is bcrypt of 'Admin@123'
INSERT INTO users (id, cafe_id, name, username, password_hash, role, is_active)
VALUES (8, NULL, 'Super Admin', 'superadmin', '$2b$10$rOzJqPJxDsFBd1kHKEiQPOmXx0hB8YnBLaCEL5AuUYSdDXjNv3Gj6', 'superadmin', 1)
ON DUPLICATE KEY UPDATE role='superadmin', cafe_id=NULL;

-- ── Step 9: Add indexes (safe, skip if already exist) ────────────
DROP PROCEDURE IF EXISTS create_index_if_missing;
DELIMITER $$
CREATE PROCEDURE create_index_if_missing(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN idx_col VARCHAR(64))
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = tbl AND index_name = idx
  ) THEN
    SET @sql3 = CONCAT('CREATE INDEX `', idx, '` ON `', tbl, '` (`', idx_col, '`)');
    PREPARE stmt3 FROM @sql3;
    EXECUTE stmt3;
    DEALLOCATE PREPARE stmt3;
  END IF;
END $$
DELIMITER ;

CALL create_index_if_missing('users',      'idx_users_cafe',      'cafe_id');
CALL create_index_if_missing('tables',     'idx_tables_cafe',     'cafe_id');
CALL create_index_if_missing('orders',     'idx_orders_cafe',     'cafe_id');
CALL create_index_if_missing('bills',      'idx_bills_cafe',      'cafe_id');
CALL create_index_if_missing('menu_items', 'idx_menu_cafe',       'cafe_id');
CALL create_index_if_missing('categories', 'idx_categories_cafe', 'cafe_id');
CALL create_index_if_missing('expenses',   'idx_expenses_cafe',   'cafe_id');
DROP PROCEDURE IF EXISTS create_index_if_missing;

SELECT CONCAT('Migration complete! Cafes in DB: ', COUNT(*), '. All data assigned to cafe_id = 1.') AS status FROM cafes;

