const Order = require("../models/order");
const stripe = require("../config/stripe");
const logger = require("../config/logger");
const { sendPaymentReceipt } = require("../config/mailer");

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
};

// Create checkout session
exports.createCheckoutSession = async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return res.status(503).json({ 
        error: "Payment system not configured. Please contact support.",
        message: "Stripe API key is missing. Please configure STRIPE_SECRET_KEY in .env file."
      });
    }

    const { productType, customerName, email, phone, secondPhone, mailingAddress } = req.body;

    // Validate product type
    if (!PRODUCTS[productType]) {
      return res.status(400).json({ error: "Invalid product type" });
    }

    // Validate required fields
    if (!customerName || !email || !phone || !mailingAddress) {
      return res.status(400).json({ error: "All required fields must be provided" });
    }

    const product = PRODUCTS[productType];

    // Create order in database
    const order = await Order.create({
      customerName,
      email,
      phone,
      secondPhone: secondPhone || "",
      mailingAddress,
      productType,
      productName: product.name,
      amount: product.price / 100, // Convert cents to dollars
      currency: "usd",
      paymentStatus: "pending",
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
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
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      // Include a canceled flag so the frontend can show an explanatory message
      // Note: Stripe only expands {CHECKOUT_SESSION_ID} in the success_url. The
      // cancel_url cannot receive the session id from Stripe, so we add a
      // simple query flag that returns the user to the checkout page.
      cancel_url: `${process.env.FRONTEND_URL}/checkout?productType=${productType}&canceled=true`,
      customer_email: email,
      metadata: {
        orderId: order._id.toString(),
        customerName,
        phone,
        secondPhone: secondPhone || "",
        mailingAddress,
        productType,
      },
    });

    // Update order with session ID
    order.stripeSessionId = session.id;
    await order.save();

    logger.info(`Checkout session created for order ${order._id}`);

    res.status(200).json({ 
      sessionId: session.id,
      url: session.url,
      orderId: order._id
    });
  } catch (error) {
    logger.error(`Error creating checkout session: ${error.message}`);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
};

// Handle webhook from Stripe
exports.handleWebhook = async (req, res) => {
  // Check if Stripe is configured
  if (!stripe) {
    logger.warn('Webhook received but Stripe is not configured');
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

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;
      
      try {
        // Update order status
        const order = await Order.findById(session.metadata.orderId);
        if (order) {
          order.paymentStatus = "completed";
          order.stripePaymentIntentId = session.payment_intent;
          await order.save();

          logger.info(`Order ${order._id} marked as completed`);

          // Send payment receipt email (best-effort)
          try {
            await sendPaymentReceipt(order);
          } catch (mailErr) {
            logger.error(`Failed to send payment receipt for order ${order._id}: ${mailErr.message}`);
          }
        }
      } catch (error) {
        logger.error(`Error updating order: ${error.message}`);
      }
      break;

    case "payment_intent.payment_failed":
      const paymentIntent = event.data.object;
      
      try {
        // Find order by payment intent and mark as failed
        const order = await Order.findOne({ stripePaymentIntentId: paymentIntent.id });
        if (order) {
          order.paymentStatus = "failed";
          await order.save();
          
          logger.info(`Order ${order._id} marked as failed`);
        }
      } catch (error) {
        logger.error(`Error updating failed order: ${error.message}`);
      }
      break;

    default:
      logger.info(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
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
