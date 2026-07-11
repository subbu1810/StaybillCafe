const mysql = require('mysql2');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'staybill_pos_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  multipleStatements: true,
  timezone:           '+05:30',
});

// Promisify for async/await
const promisePool = pool.promise();

// Test connection on startup
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ MySQL connection failed:', err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   → Check DB_USER and DB_PASSWORD in your .env file');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('   → Make sure MySQL server is running');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error('   → Database not found. Run: npm run db:setup');
    }
  } else {
    console.log('✅ MySQL connected successfully');
    connection.release();
  }
});

module.exports = promisePool;
