const QR = require('../models/QR');
const Analytics = require('../models/Analytics');
const crypto = require('crypto');
const { deviceBucket } = require('./analyticsController');

const generateCode = () => crypto.randomBytes(4).toString('hex');

// @desc    Create new QR Code
// @route   POST /api/qr
// @access  Public
const createQR = async (req, res, next) => {
  try {
    const { title, type, dynamic, destination, payload, style, logo, cardTemplate, cardStyle, cardConfig, mediaUrl, mediaType, code } = req.body;

    const qrData = {
      title,
      type,
      dynamic: dynamic === undefined ? true : dynamic,
      destination,
      payload,
      style,
      logo,
      cardTemplate,
      cardStyle,
      cardConfig,
      mediaUrl,
      mediaType
    };

    if (qrData.dynamic) {
      let requestedCode = typeof code === 'string' ? code.trim() : '';
      if (requestedCode) {
        const existing = await QR.findOne({ code: requestedCode });
        if (existing) {
          return res.status(409).json({ message: 'That dynamic URL alias is already in use. Change the title, destination, or custom alias.' });
        }
        qrData.code = requestedCode;
      } else {
        let unique = false;
        let newCode = '';
        while (!unique) {
          newCode = generateCode();
          const existing = await QR.findOne({ code: newCode });
          if (!existing) unique = true;
        }
        qrData.code = newCode;
      }
    }

    const qr = await QR.create(qrData);
    res.status(201).json(qr);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all QR Codes
// @route   GET /api/qr
// @access  Public
const getQRs = async (req, res, next) => {
  try {
    const qrs = await QR.find({}).sort({ createdAt: -1 });
    res.json(qrs);
  } catch (error) {
    next(error);
  }
};

// @desc    Get QR by ID
// @route   GET /api/qr/:id
// @access  Public
const getQRById = async (req, res, next) => {
  try {
    const qr = await QR.findById(req.params.id);
    if (qr) {
      res.json(qr);
    } else {
      res.status(404);
      throw new Error('QR not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update QR configuration
// @route   PUT /api/qr/:id
// @access  Public
const updateQR = async (req, res, next) => {
  try {
    const { title, destination, payload, style, logo, cardTemplate, cardStyle, cardConfig, mediaUrl, mediaType, active } = req.body;
    
    const qr = await QR.findById(req.params.id);

    if (qr) {
      qr.title = title !== undefined ? title : qr.title;
      qr.destination = destination !== undefined ? destination : qr.destination;
      qr.payload = payload !== undefined ? payload : qr.payload;
      qr.style = style !== undefined ? style : qr.style;
      qr.logo = logo !== undefined ? logo : qr.logo;
      qr.cardTemplate = cardTemplate !== undefined ? cardTemplate : qr.cardTemplate;
      qr.cardStyle = cardStyle !== undefined ? cardStyle : qr.cardStyle;
      qr.cardConfig = cardConfig !== undefined ? cardConfig : qr.cardConfig;
      qr.mediaUrl = mediaUrl !== undefined ? mediaUrl : qr.mediaUrl;
      qr.mediaType = mediaType !== undefined ? mediaType : qr.mediaType;
      qr.active = active !== undefined ? Boolean(active) : qr.active;

      const updatedQR = await qr.save();
      res.json(updatedQR);
    } else {
      res.status(404);
      throw new Error('QR not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Delete QR
// @route   DELETE /api/qr/:id
// @access  Public
const toggleQR = async (req, res, next) => {
  try {
    const qr = await QR.findById(req.params.id);
    if (!qr) return res.status(404).json({ message: 'QR not found' });
    qr.active = !qr.active;
    await qr.save();
    res.json(qr);
  } catch (error) { next(error); }
};

const deleteQR = async (req, res, next) => {
  try {
    const qr = await QR.findById(req.params.id);

    if (qr) {
      await QR.deleteOne({ _id: qr._id });
      // Delete analytics associated
      await Analytics.deleteMany({ qrId: qr._id });
      res.json({ message: 'QR removed' });
    } else {
      res.status(404);
      throw new Error('QR not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Dynamic QR Redirect
// @route   GET /d/:code
// @access  Public
const dynamicRedirect = async (req, res, next) => {
  try {
    const code = req.params.code;
    const qr = await QR.findOne({ code });

    if (qr && qr.dynamic && qr.active !== false) {
      // Create Analytics entry
      await Analytics.create({
        qrId: qr._id,
        ip: req.ip || req.connection.remoteAddress,
        browser: req.headers['user-agent'],
        device: deviceBucket(req.headers['user-agent']),
        referrer: req.headers['referer'] || req.headers['referrer'],
      });

      // Increment click count
      qr.clicks += 1;
      await qr.save();

      // Ensure URL has http protocol if it's a URL type
      let dest = qr.destination || '';
      if (qr.type === 'URL' && !dest.startsWith('http://') && !dest.startsWith('https://')) {
        dest = 'http://' + dest;
      }

      return res.redirect(302, dest);
    } else {
      res.status(404).send('Invalid or expired QR code.');
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createQR,
  getQRs,
  getQRById,
  updateQR,
  toggleQR,
  deleteQR,
  dynamicRedirect
};
