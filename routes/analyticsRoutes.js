const express = require('express');
const router = express.Router();
const { getAnalytics } = require('../controllers/analyticsController');

// /api/analytics
router.route('/:id').get(getAnalytics);

module.exports = router;
