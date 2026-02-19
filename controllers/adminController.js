const { transporter } = require('../config/mailer');
const logger = require('../config/logger');

// Secure test endpoint to verify mailer and send a test message.
// Protect with TEST_MAIL_KEY environment variable when set.
exports.testMail = async (req, res) => {
  const key = req.query.key || '';

  if (process.env.TEST_MAIL_KEY && key !== process.env.TEST_MAIL_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const to = process.env.NOTIFICATION_MAIL_TO || process.env.MAIL_USER;
  const from = process.env.NOTIFICATION_MAIL_FROM || process.env.MAIL_USER;

  try {
    // Verify transporter configuration and connectivity
    await transporter.verify();

    const info = await transporter.sendMail({
      from,
      to,
      subject: `Test email from ${process.env.APP_NAME || 'app'}`,
      text: `This is a test message sent at ${new Date().toISOString()}`,
    });

    logger.info('Test email sent', info);
    return res.status(200).json({ ok: true, info });
  } catch (err) {
    logger.error('Test email failed', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};
