const mongoose = require('mongoose');

const shortURLSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  originalUrl: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, trim: true, index: true },
  clicks: { type: Number, default: 0 },
  lastClickedAt: { type: Date, default: null },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('ShortURL', shortURLSchema);
