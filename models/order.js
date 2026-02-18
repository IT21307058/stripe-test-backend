const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
    },
    secondPhone: {
      type: String,
      default: "",
    },
    mailingAddress: {
      type: String,
      required: [true, "Mailing address is required"],
    },
    productType: {
      type: String,
      required: [true, "Product type is required"],
      enum: ["chatgpt-class", "book"],
    },
    productName: {
      type: String,
      required: [true, "Product name is required"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
    },
    currency: {
      type: String,
      default: "usd",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Order", orderSchema);
