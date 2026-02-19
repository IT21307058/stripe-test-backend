const express = require('express');
const router = express.Router();
const { testMail } = require('../controllers/adminController');

// GET /api/admin/test-mail?key=SECRET
router.get('/test-mail', testMail);

module.exports = router;
