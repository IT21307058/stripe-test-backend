const Order = require("../models/order");
const stripe = require("../config/stripe");
const logger = require("../config/logger");
const { sendPaymentReceipt, sendMerchantRegistrationNotification } = require("../config/mailer");

// Product configurations
const PRODUCTS = {
  "chatgpt-class": {
    name: "How to Use Chat GPT Class",
    price: 100, // $1.00 in cents
    description: "Learn how to use ChatGPT effectively",
  },
  book: {
    name: "Preethi's Book Download",
    price: 100, // $1.00 in cents
    description: "Download Preethi's exclusive book",
  },
  "ai-mastery": {
    name: "AI Mastery",
    price: 50, // $0.50 in cents
    description:
      "AI Mastery — Save on Discounts, Airline Tickets, Hotels with ChatGPT AI. Event: Tuesday March 3rd, 7-8pm.",
  },
};


exports.payRedirectToStripe = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).send("Stripe not configured. Missing STRIPE_SECRET_KEY.");
    }

    const { productType } = req.params;

    if (!PRODUCTS[productType]) {
      return res.status(400).send("Invalid product type");
    }

    const product = PRODUCTS[productType];

    // Create a minimal order (optional but good for tracking)
    const order = await Order.create({
      productType,
      productName: product.name,
      amount: product.price / 100, // 0.10
      currency: "usd",
      paymentStatus: "pending",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: product.price,
          },
          quantity: 1,
        },
      ],

      // ✅ Stripe collects these details in the checkout itself
      billing_address_collection: "required",     // "Mailing Address" best match in Stripe
      phone_number_collection: { enabled: true }, // Phone

      // ✅ Second phone number (Stripe Checkout custom field)
      custom_fields: [
        {
          key: "second_phone_number",
          label: { type: "custom", custom: "Second phone number (optional)" },
          type: "text",
          optional: true,
        },
      ],

      // ✅ Client's required message at bottom of the checkout
      custom_text: {
        submit: {
          message:
            "We appreciate your business. Thank you for buying from us. If you feel there has been an error, or have questions, please contact pre@preethifernando.com Please put in subject line, Product/Service Purchase Question.",
        },
      },

      // Success page can show popup message (your frontend or a simple page)
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/checkout?productType=${productType}&canceled=true`,

      metadata: {
        orderId: order._id.toString(),
        productType,
        productName: product.name,
      },
    });

    // Save session id
    order.stripeSessionId = session.id;
    await order.save();

    // ✅ IMPORTANT: redirect directly to Stripe checkout
    return res.redirect(303, session.url);
  } catch (error) {
    logger.error(`Error creating Stripe redirect session: ${error.message}`);
    return res.status(500).send("Failed to start checkout");
  }
};


exports.handleWebhook = async (req, res) => {
  if (!stripe) {
    logger.warn("Webhook received but Stripe is not configured");
    return res.status(503).json({ error: "Payment system not configured" });
  }

  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // ✅ Get full session with customer + line item details
        const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ["line_items", "customer_details"],
        });

        const orderId = fullSession.metadata?.orderId;
        if (!orderId) {
          logger.warn(`checkout.session.completed missing metadata.orderId (session: ${fullSession.id})`);
          break;
        }

        const order = await Order.findById(orderId);
        if (!order) {
          logger.warn(`Order not found for orderId=${orderId}`);
          break;
        }

        // ✅ Identify purchased product name (so receipt/admin knows)
        const lineItem = fullSession.line_items?.data?.[0];
        const purchasedName =
          lineItem?.description ||
          fullSession.metadata?.productName ||
          order.productName;

        // ✅ Capture customer details from Stripe checkout
        const customer = fullSession.customer_details || {};
        const address = customer.address || {};

        order.paymentStatus = "completed";
        order.stripePaymentIntentId = fullSession.payment_intent;
        order.stripeSessionId = fullSession.id;

        // Store what they bought + amounts
        order.productName = purchasedName;
        order.amount = (fullSession.amount_total || 0) / 100;
        order.currency = fullSession.currency || "usd";

        // Store customer info (now it comes from Stripe, not req.body)
        order.email = customer.email || order.email;
        order.customerName = customer.name || order.customerName;
        order.phone = customer.phone || order.phone;

        // Mailing address (best match)
        order.mailingAddress = [
          address.line1,
          address.line2,
          address.city,
          address.state,
          address.postal_code,
          address.country,
        ]
          .filter(Boolean)
          .join(", ");

        // ✅ Second phone from custom field (Stripe stores under custom_fields)
        const secondPhoneField = (fullSession.custom_fields || []).find(
          (f) => f.key === "second_phone_number"
        );
        order.secondPhone = secondPhoneField?.text?.value || order.secondPhone || "";

        await order.save();

        // Optional: send customer receipt
        try {
          await sendPaymentReceipt(order);
        } catch (mailErr) {
          logger.error(`Failed to send payment receipt for order ${order._id}`, mailErr);
        }

        // Notify merchant specifically for AI Mastery registrations
        try {
          if (
            order.productType === 'ai-mastery' ||
            (order.productName || '').toLowerCase().includes('ai mastery')
          ) {
            await sendMerchantRegistrationNotification(order);
          }
        } catch (notifyErr) {
          logger.error(`Failed to send merchant registration notification for order ${order._id}`, notifyErr);
        }

        logger.info(`Order ${order._id} completed. Product: ${order.productName}`);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;

        if (orderId) {
          const order = await Order.findById(orderId);
          if (order && order.paymentStatus === "pending") {
            order.paymentStatus = "expired";
            await order.save();
            logger.info(`Order ${order._id} marked as expired`);
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;

        const order = await Order.findOne({ stripePaymentIntentId: paymentIntent.id });
        if (order) {
          order.paymentStatus = "failed";
          await order.save();
          logger.info(`Order ${order._id} marked as failed`);
        }
        break;
      }

      default:
        logger.info(`Unhandled event type ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error) {
    logger.error(`Webhook handler error: ${error.message}`, error);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
};

// Get order details
exports.getOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json({ order });
  } catch (error) {
    logger.error(`Error fetching order: ${error.message}`);
    res.status(500).json({ error: "Failed to fetch order" });
  }
};

// Get order by session ID
exports.getOrderBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const order = await Order.findOne({ stripeSessionId: sessionId });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json({ order });
  } catch (error) {
    logger.error(`Error fetching order by session: ${error.message}`);
    res.status(500).json({ error: "Failed to fetch order" });
  }
};

// Get all orders
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });

    res.status(200).json({ orders, count: orders.length });
  } catch (error) {
    logger.error(`Error fetching orders: ${error.message}`);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};
