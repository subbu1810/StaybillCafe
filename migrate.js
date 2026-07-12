require('dotenv').config();
const db = require('./config/db');

async function migrate() {
    try {
        console.log("Running DB migrations...");

        // 1. Add customer_ordering_enabled to restaurant_settings
        try {
            await db.execute('ALTER TABLE restaurant_settings ADD COLUMN customer_ordering_enabled TINYINT(1) NOT NULL DEFAULT 0');
            console.log("Added customer_ordering_enabled");
        } catch (e) {
            console.log("customer_ordering_enabled might already exist or error:", e.message);
        }

        // 2. Add direct_to_kitchen_enabled to restaurant_settings
        try {
            await db.execute('ALTER TABLE restaurant_settings ADD COLUMN direct_to_kitchen_enabled TINYINT(1) NOT NULL DEFAULT 0');
            console.log("Added direct_to_kitchen_enabled");
        } catch (e) {
            console.log("direct_to_kitchen_enabled might already exist or error:", e.message);
        }

        // 3. Make captain_id NULLable in orders
        try {
            await db.execute('ALTER TABLE orders MODIFY captain_id INT NULL');
            console.log("Modified captain_id in orders to be NULLable");
        } catch (e) {
            console.log("Error modifying captain_id in orders:", e.message);
        }

        // 4. Make captain_id NULLable in kots
        try {
            await db.execute('ALTER TABLE kots MODIFY captain_id INT NULL');
            console.log("Modified captain_id in kots to be NULLable");
        } catch (e) {
            console.log("Error modifying captain_id in kots:", e.message);
        }

        console.log("Migrations finished.");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

migrate();
