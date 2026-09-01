const express = require('express');
const router = express.Router();
const { getAnalytics, getOverview } = require('../controllers/analyticsController');

router.get('/overview', getOverview);
router.get('/:id', getAnalytics);

module.exports = router;
