// Initialize Stripe only if secret key is provided and valid
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey || stripeSecretKey === 'sk_test_your_stripe_secret_key_here') {
  console.warn('⚠️  WARNING: Stripe secret key not configured. Payment features will not work.');
  console.warn('   Please add your Stripe secret key to the .env file');
  console.warn('   Get your key from: https://dashboard.stripe.com/apikeys\n');
  
  // Export a dummy stripe object to prevent crashes
  module.exports = null;
} else {
  const stripe = require("stripe")(stripeSecretKey);
  module.exports = stripe;
}
