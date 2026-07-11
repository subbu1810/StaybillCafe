/**
 * One-shot database setup script.
 * Run: npm run db:setup
 * Creates the DB, tables, and seeds demo data.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

async function setup() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('✅ Connected to MySQL server');

  const schema = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
  const seed   = fs.readFileSync(path.join(__dirname, '../database/seed.sql'), 'utf8');

  console.log('🗄️  Running schema...');
  await conn.query(schema);
  console.log('✅ Schema created');

  console.log('🌱 Running seed...');
  await conn.query(seed);
  console.log('✅ Seed data inserted');

  await conn.end();
  console.log('\n🎉 Database setup complete! Run: npm run dev\n');
}

setup().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
