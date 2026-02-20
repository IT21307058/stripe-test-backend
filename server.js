const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  process.exit(1);
});

const connectDB = require("./db/db");
const errorHandler = require("./middlewares/errorhandler");
const userRoutes = require("./routes/userRoutes");
const orderRoutes = require("./routes/orderRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const logger = require("./config/logger");

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());

//connect to the database
connectDB();

// Webhook route MUST be before express.json() to get raw body
app.use("/api/webhook", webhookRoutes);

// JSON body parser
app.use(express.json());

//routes
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);

app.use("/api/products", (req, res) => {
  return res.status(200).json({
    message: "This is new feature change, a new route for products samin bhanuka",
  });
});


//error handler
app.use(errorHandler);

//listen to the server
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
  logger.info(`Server is running on port: ${port}`);
});
