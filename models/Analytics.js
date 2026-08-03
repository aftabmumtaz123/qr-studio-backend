const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  qrId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QR',
    required: true
  },
  ip: {
    type: String
  },
  browser: {
    type: String
  },
  country: {
    type: String
  },
  city: {
    type: String
  },
  device: {
    type: String
  },
  os: {
    type: String
  },
  referrer: {
    type: String
  },
  scannedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Analytics', analyticsSchema);
