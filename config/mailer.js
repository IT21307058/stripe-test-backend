const fs = require('fs');
const path = require('path');
const sgMail = require('@sendgrid/mail');
const logger = require('./logger');

// Configure SendGrid API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  logger.warn('SENDGRID_API_KEY not set; emails will fail until configured');
}

async function sendPaymentReceipt(order) {
  try {
    const from = process.env.NOTIFICATION_MAIL_FROM || process.env.MAIL_USER || 'no-reply@example.com';

    // Load HTML template. Try in this order:
    // 1) explicit EMAIL_TEMPLATE_PATH env var
    // 2) backend/email-templates (relative to this config file)
    // 3) project-level email-templates (../..)
    const candidates = [];
    if (process.env.EMAIL_TEMPLATE_PATH) candidates.push(process.env.EMAIL_TEMPLATE_PATH);
    candidates.push(path.join(__dirname, 'email-templates', 'payment-receipt.html'));
    candidates.push(path.join(__dirname, '..', 'email-templates', 'payment-receipt.html'));
    candidates.push(path.join(__dirname, '..', '..', 'email-templates', 'payment-receipt.html'));

    let html = '';
    let usedPath = null;
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          html = fs.readFileSync(p, 'utf8');
          usedPath = p;
          break;
        }
      } catch (e) {
        // continue to next candidate
      }
    }

    if (!usedPath) {
      logger.warn('Payment receipt template not found in candidates; using simple fallback HTML', { candidates });
      html = `<p>Hi ${order.customerName || ''},</p><p>Thank you for your purchase of <strong>${order.productName || ''}</strong>.</p>`;
    } else {
      logger.debug('Using payment receipt template', { path: usedPath });
    }

    // Prepare values for template
    const orderUrl = `${process.env.FRONTEND_URL || ''}/orders/${order._id}`;
    const values = {
      logoUrl: process.env.COMPANY_LOGO_URL || 'https://example.com/logo.png',
      customerName: order.customerName || '',
      orderId: order.orderId || order._id,
      productName: order.productName || '',
      amount: (typeof order.amount === 'number') ? `$${Number(order.amount).toFixed(2)}` : order.amount || '',
      paymentStatus: order.paymentStatus || '',
      date: (order.createdAt || new Date()).toISOString(),
      orderUrl,
      email: order.email || '',
      supportEmail: 'pre@preethifernando.com',
      companyName: 'Kelum',
      year: new Date().getFullYear(),
    };

    // Replace placeholders like {{key}}
    Object.keys(values).forEach((k) => {
      const re = new RegExp(`{{\\s*${k}\\s*}}`, 'g');
      html = html.replace(re, values[k]);
    });

    const text = `Thank you ${values.customerName} for your purchase of ${values.productName}.\n\nOrder ID: ${values.orderId}\nAmount: ${values.amount}\nStatus: ${values.paymentStatus}\n\nView order: ${orderUrl}`;

    const msg = {
      to: order.email,
      from,
      subject: `Payment received — Order ${values.orderId}`,
      text,
      html,
    };

    const info = await sgMail.send(msg);
    logger.info(`Payment receipt sent for order ${order._id} to ${order.email}`);
    return info;
  } catch (err) {
    if (err && err.response && err.response.body) {
      logger.error(`Failed to send payment receipt for order ${order._id}:`, err.response.body);
    } else {
      logger.error(`Failed to send payment receipt for order ${order._id}`, err);
    }
    throw err;
  }
}

async function sendMerchantRegistrationNotification(order) {
  try {
    const to = process.env.ADMIN_MAIL;
    if (!to) {
      logger.warn('No merchant notification address configured (ADMIN_MAIL)');
      return;
    }

    const from = process.env.NOTIFICATION_MAIL_FROM || process.env.MAIL_USER || 'no-reply@example.com';
    const subject = 'Preethi Fernando registered for your AI mastery class.';

    const amount = (typeof order.amount === 'number') ? `$${Number(order.amount).toFixed(2)}` : order.amount || '';

    const html = `<p>${subject}</p>
      <ul>
        <li>Order ID: ${order.orderId || order._id}</li>
        <li>Product: ${order.productName || ''}</li>
        <li>Name: ${order.customerName || ''}</li>
        <li>Email: ${order.email || ''}</li>
        <li>Phone: ${order.phone || ''}</li>
        <li>Amount: ${amount}</li>
      </ul>`;

    const text = html.replace(/<[^>]+>/g, '');

    const msg = {
      to,
      from,
      subject,
      text,
      html,
    };

    await sgMail.send(msg);
    logger.info(`Merchant notification sent for order ${order._id} to ${to}`);
  } catch (err) {
    logger.error(`Failed to send merchant notification for order ${order._id}`, err);
    throw err;
  }
}

module.exports = { sendPaymentReceipt, sendMerchantRegistrationNotification };

