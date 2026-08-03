const Analytics = require('../models/Analytics');

// @desc    Get basic analytics for a specific QR
// @route   GET /api/analytics/:id
// @access  Public
const getAnalytics = async (req, res, next) => {
  try {
    const totalScans = await Analytics.countDocuments({ qrId: req.params.id });
    
    const scansList = await Analytics.find({ qrId: req.params.id })
      .sort({ scannedAt: -1 })
      .limit(100);

    res.json({
      totalScans,
      recentScans: scansList
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAnalytics };
