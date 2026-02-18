const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// Create checkout session
router.post("/create-checkout-session", orderController.createCheckoutSession);

// Get order by ID
router.get("/:orderId", orderController.getOrder);

// Get order by session ID
router.get("/session/:sessionId", orderController.getOrderBySession);

// Get all orders
router.get("/", orderController.getAllOrders);

module.exports = router;
