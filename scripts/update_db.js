require('dotenv').config({ path: 'c:/Users/DELL/Desktop/All Projects/Hotel mobile app/backend/.env' });
const db = require('c:/Users/DELL/Desktop/All Projects/Hotel mobile app/backend/config/db');

async function updateDB() {
  try {
    await db.query('ALTER TABLE cafes ADD COLUMN subscription_end_date DATETIME NULL AFTER plan');
    console.log('Altered cafes table');
  } catch(e) {
    console.log('Column might exist', e.message);
  }
  
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cafe_id INT NOT NULL,
      plan_duration INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      razorpay_order_id VARCHAR(100),
      razorpay_payment_id VARCHAR(100),
      razorpay_signature VARCHAR(255),
      status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
    console.log('Created subscriptions table');
  } catch(e) {
    console.log('Error creating table', e.message);
  }
  process.exit(0);
}

updateDB();
