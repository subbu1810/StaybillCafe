require('dotenv').config();
const db = require('./config/db');
async function run() {
  await db.query("UPDATE tables SET status = 'available'");
  console.log('All tables updated to available');
  process.exit();
}
run();
