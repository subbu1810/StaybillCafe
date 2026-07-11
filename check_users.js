require('dotenv').config();
const db = require('./config/db');

async function run() {
  const [users] = await db.query("SELECT * FROM users");
  console.log(users);
  process.exit();
}
run();
