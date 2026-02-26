const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      // required: [true, "Customer name is required"],
    },
    email: {
      type: String,
      // required: [true, "Email is required"],
    },
    phone: {
      type: String,
      // required: [true, "Phone number is required"],
    },
    secondPhone: {
      type: String,
      default: "",
    },
    mailingAddress: {
      type: String,
      // required: [true, "Mailing address is required"],
    },
    productType: {
      type: String,
      // required: [true, "Product type is required"],
      enum: ["chatgpt-class", "book", "ai-mastery"],
    },
    productName: {
      type: String,
      // required: [true, "Product name is required"],
    },
    amount: {
      type: Number,
      // required: [true, "Amount is required"],
    },
    currency: {
      type: String,
      default: "usd",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "expired"],
      default: "pending",
    },
    stripeSessionId: {
      type: String,
      default: "",
    },
    stripePaymentIntentId: {
      type: String,
      default: "",
    },
    orderId: {
      type: String,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Generate a human-friendly orderId starting with 'OR' if not provided
orderSchema.pre('save', async function (next) {
  if (this.orderId) return next();

  // Create a reasonably unique ID: OR + timestamp slice + random 4 digits
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(1000 + Math.random() * 9000).toString();
  this.orderId = `OR${ts}${rand}`;

  // Ensure uniqueness — rare collision; regenerate if exists
  const Order = this.constructor;
  const exists = await Order.findOne({ orderId: this.orderId }).lean();
  if (exists) {
    this.orderId = `OR${ts}${Math.floor(1000 + Math.random() * 9000)}`;
  }

  return next();
});

module.exports = mongoose.model("Order", orderSchema);
