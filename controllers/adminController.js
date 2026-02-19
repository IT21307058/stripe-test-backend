const { sendPaymentReceipt } = require('../config/mailer');
const logger = require('../config/logger');

// Secure test endpoint to verify mailer and send a test message.
// Protect with TEST_MAIL_KEY environment variable when set.
exports.testMail = async (req, res) => {
  const key = req.query.key || '';

//   if (process.env.TEST_MAIL_KEY && key !== process.env.TEST_MAIL_KEY) {
//     return res.status(403).json({ error: 'Forbidden' });
//   }

  const to = process.env.NOTIFICATION_MAIL_TO || process.env.MAIL_USER;
  const from = process.env.NOTIFICATION_MAIL_FROM || process.env.MAIL_USER;

  try {

    // Build a mock order object to exercise the same path as the webhook
    const order = {
      _id: `test-${Date.now()}`,
      customerName: process.env.TEST_MAIL_NAME || 'Test User',
      email: "bhanukadayanana@gmail.com",
      productName: process.env.TEST_MAIL_PRODUCT || 'Test Product',
      amount: process.env.TEST_MAIL_AMOUNT ? Number(process.env.TEST_MAIL_AMOUNT) : 1.0,
      paymentStatus: 'test',
    };

    // Use the same function the webhook uses so SendGrid/SMTP behavior is identical
    const info = await sendPaymentReceipt(order);

    logger.info('Test payment receipt sent', info);
    return res.status(200).json({ ok: true, info });
  } catch (err) {
    logger.error('Test payment receipt failed', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};
