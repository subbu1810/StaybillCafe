require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 3306,
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'cafe_mobile',
      multipleStatements: true,
    });

    console.log('✅ Connected to MySQL server');

    await conn.query(`
      ALTER TABLE restaurant_settings 
      ADD COLUMN IF NOT EXISTS upi_id VARCHAR(50) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS is_upi_enabled TINYINT(1) NOT NULL DEFAULT 0;
    `);

    console.log('✅ Added upi_id and is_upi_enabled columns to restaurant_settings');
  } catch (err) {
    // MariaDB/MySQL might not support IF NOT EXISTS in ALTER TABLE in all versions.
    // If it fails, let's catch the duplicate column error.
    if (err.code === 'ER_DUP_FIELDNAME') {
       console.log('✅ Columns already exist. Skipping.');
    } else {
       console.log('⚠️  Falling back to manual check due to syntax error:', err.message);
       if (conn) {
         try {
           const [columns] = await conn.query("SHOW COLUMNS FROM restaurant_settings LIKE 'upi_id'");
           if (columns.length === 0) {
             await conn.query("ALTER TABLE restaurant_settings ADD COLUMN upi_id VARCHAR(50) DEFAULT NULL");
             await conn.query("ALTER TABLE restaurant_settings ADD COLUMN is_upi_enabled TINYINT(1) NOT NULL DEFAULT 0");
             console.log('✅ Added upi_id and is_upi_enabled columns to restaurant_settings');
           } else {
             console.log('✅ Columns already exist. Skipping.');
           }
         } catch(e2) {
           console.error('❌ Migration failed:', e2.message);
         }
       }
    }
  } finally {
    if (conn) await conn.end();
    process.exit(0);
  }
}

migrate();
