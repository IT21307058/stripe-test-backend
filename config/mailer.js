// const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const logger = require('./logger');

// // Build transporter from environment variables
// const transporter = nodemailer.createTransport({
//   host: process.env.MAIL_HOST || 'smtp.gmail.com',
//   port: Number(process.env.MAIL_PORT) || 587,
//   secure: process.env.MAIL_SECURE === 'true' || false, // true for 465, false for other ports
//   auth: {
//     user: process.env.MAIL_USER || process.env.SMTP_USERNAME,
//     pass: process.env.MAIL_PASS || process.env.SMTP_PASSWORD,
//   },
//   tls: {
//     // Allow self-signed certs in dev if needed (set MAIL_TLS_REJECT to 'true' to enforce)
//     rejectUnauthorized: false,
//   },
// });

// // Verify transporter at startup (non-blocking)
// transporter.verify().then(() => {
//   logger.info('Mail transporter configured');
// }).catch((err) => {
//   logger.warn('Mail transporter verification failed', err);
// });

// async function sendPaymentReceipt(order) {
//   try {
//     const to = order.email;
//     const from = process.env.NOTIFICATION_MAIL_FROM || process.env.MAIL_USER || process.env.SMTP_USERNAME;

//     const subject = `Payment received — Order ${order._id}`;

//     const text = `Thank you ${order.customerName} for your purchase of ${order.productName}.\n\nOrder ID: ${order._id}\nAmount: $${Number(order.amount).toFixed(2)}\nStatus: ${order.paymentStatus}`;

//     const html = `<p>Hi ${order.customerName},</p>
//       <p>Thank you for your purchase of <strong>${order.productName}</strong>.</p>
//       <ul>
//         <li><strong>Order ID:</strong> ${order._id}</li>
//         <li><strong>Amount:</strong> $${Number(order.amount).toFixed(2)}</li>
//         <li><strong>Payment Status:</strong> ${order.paymentStatus}</li>
//       </ul>
//       <p>If you have any questions, reply to this email or contact support.</p>
//       <p>— Your Team</p>`;

//     const info = await transporter.sendMail({
//       from,
//       to,
//       subject,
//       text,
//       html,
//     });

//     logger.info(`Payment receipt email sent for order ${order._id} to ${to} (messageId: ${info.messageId})`);
//     return info;
//   } catch (err) {
//     logger.error(`Failed to send payment receipt for order ${order._id}`, err);
//     throw err;
//   }
// }

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendPaymentReceipt(order) {
  try {
    const from = process.env.NOTIFICATION_MAIL_FROM || process.env.MAIL_USER;

    const msg = {
      to: order.email,
      from,
      subject: `Payment received — Order ${order._id}`,
      text: `Thank you ${order.customerName} for your purchase of ${order.productName}.\n\nOrder ID: ${order._id}\nAmount: $${Number(order.amount).toFixed(2)}\nStatus: ${order.paymentStatus}`,
      html: `<p>Hi ${order.customerName},</p>
        <p>Thank you for your purchase of <strong>${order.productName}</strong>.</p>
        <ul>
          <li><strong>Order ID:</strong> ${order._id}</li>
          <li><strong>Amount:</strong> $${Number(order.amount).toFixed(2)}</li>
          <li><strong>Payment Status:</strong> ${order.paymentStatus}</li>
        </ul>
        <p>If you have any questions, reply to this email or contact support.</p>
        <p>— Your Team</p>`,
    };

    const info = await sgMail.send(msg);
    logger.info(`Payment receipt sent for order ${order._id} to ${order.email}`);
    return info;
  } catch (err) {
    // Log SendGrid response details when available to make debugging easier
    if (err && err.response && err.response.body) {
      logger.error(`Failed to send payment receipt for order ${order._id}:`, err.response.body);
    } else {
      logger.error(`Failed to send payment receipt for order ${order._id}`, err);
    }
    throw err;
  }
}

module.exports = { sendPaymentReceipt };
