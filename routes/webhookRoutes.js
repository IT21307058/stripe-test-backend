const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// Stripe webhook - needs raw body
router.post(
  "/",
  express.raw({ type: "application/json" }),
  orderController.handleWebhook
);

module.exports = router;
