/**
 * Script to reset all user passwords to 'password123' with a correct bcrypt hash
 * Run: node database/reset-passwords.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function resetPasswords() {
  try {
    console.log('Generating bcrypt hash for "password123"...');
    const hash = await bcrypt.hash('password123', 10);
    console.log('Hash generated:', hash);

    // Verify the hash works
    const ok = await bcrypt.compare('password123', hash);
    console.log('Hash verified:', ok);

    if (!ok) {
      console.error('❌ Hash verification failed!');
      process.exit(1);
    }

    // Update all users
    const [result] = await db.query(
      'UPDATE users SET password_hash = ?',
      [hash]
    );
    console.log(`✅ Updated ${result.affectedRows} user(s) with new password hash.`);
    console.log('');
    console.log('All users now have password: password123');
    console.log('Login credentials:');
    console.log('  admin    / password123');
    console.log('  captain1 / password123');
    console.log('  captain2 / password123');
    console.log('  cashier1 / password123');
    console.log('  cashier2 / password123');
    console.log('  kitchen1 / password123');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

resetPasswords();
