const db = require('../config/db');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Order
exports.createOrder = async (req, res) => {
  try {
    const { plan_duration } = req.body;
    if (!plan_duration) return res.status(400).json({ success: false, message: 'plan_duration is required (6 or 12)' });

    let amount = 0;
    if (plan_duration === 6) {
      amount = 1799; // base
    } else if (plan_duration === 12) {
      amount = 2988; // base
    } else {
      return res.status(400).json({ success: false, message: 'Invalid plan duration' });
    }

    // Add 18% GST
    const gstAmount = amount * 0.18;
    const finalAmount = amount + gstAmount;
    const finalAmountPaise = Math.round(finalAmount * 100);

    const options = {
      amount: finalAmountPaise,
      currency: 'INR',
      receipt: `rcpt_${req.user.cafe_id}_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    // Save to subscriptions table
    await db.query(
      `INSERT INTO subscriptions (cafe_id, plan_duration, amount, razorpay_order_id, status) VALUES (?, ?, ?, ?, 'pending')`,
      [req.user.cafe_id, plan_duration, finalAmount, order.id]
    );

    res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Create Razorpay Order Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Verify Payment
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'dummy_secret')
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      await db.query(`UPDATE subscriptions SET status = 'failed' WHERE razorpay_order_id = ?`, [razorpay_order_id]);
      return res.status(400).json({ success: false, message: 'Invalid Signature' });
    }

    // Mark success
    await db.query(
      `UPDATE subscriptions SET status = 'success', razorpay_payment_id = ?, razorpay_signature = ? WHERE razorpay_order_id = ?`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id]
    );

    // Get the plan duration
    const [sub] = await db.query(`SELECT plan_duration FROM subscriptions WHERE razorpay_order_id = ?`, [razorpay_order_id]);
    if (sub.length > 0) {
      const duration = sub[0].plan_duration; // 6 or 12
      // Update cafes table
      // If subscription_end_date is null or in the past, set to now + duration months
      // If it's in the future, add duration months to it.
      await db.query(`
        UPDATE cafes 
        SET plan = 'pro', 
            subscription_end_date = CASE 
              WHEN subscription_end_date IS NULL OR subscription_end_date < NOW() THEN DATE_ADD(NOW(), INTERVAL ? MONTH)
              ELSE DATE_ADD(subscription_end_date, INTERVAL ? MONTH)
            END
        WHERE id = ?
      `, [duration, duration, req.user.cafe_id]);
    }

    res.json({ success: true, message: 'Payment successful, subscription activated!' });
  } catch (error) {
    console.error('Verify Payment Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
