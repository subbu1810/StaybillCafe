const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'cafe_mobile'
        });

        console.log('Connected to the database. Creating menu_item_ingredients table...');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS menu_item_ingredients (
              id                  INT AUTO_INCREMENT PRIMARY KEY,
              menu_item_id        INT           NOT NULL,
              inventory_id        INT           NOT NULL,
              quantity_required   DECIMAL(10,2) NOT NULL DEFAULT 1,
              created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
              FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);
        console.log('Added menu_item_ingredients table.');

        await connection.end();
        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

migrate();
