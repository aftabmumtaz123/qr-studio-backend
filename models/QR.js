const mongoose = require('mongoose');

const qrSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  dynamic: {
    type: Boolean,
    default: true
  },
  code: {
    type: String,
    unique: true,
    sparse: true
  },
  destination: {
    type: String,
  },
  payload: {
    type: Object, 
  },
  style: {
    type: Object,
    default: {}
  },
  cardTemplate: {
    type: String,
    default: 'modern'
  },
  cardStyle: {
    type: Object,
    default: {}
  },
  cardConfig: {
    type: Object,
    default: {}
  },
  mediaUrl: {
    type: String
  },
  mediaType: {
    type: String
  },
  logo: {
    type: String
  },
  createdBy: {
    type: String,
    default: 'anonymous',
  },
  clicks: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('QR', qrSchema);
