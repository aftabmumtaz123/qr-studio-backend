const QR = require('../models/QR');
const Analytics = require('../models/Analytics');
const crypto = require('crypto');
const { deviceBucket } = require('./analyticsController');

const generateCode = () => crypto.randomBytes(4).toString('hex');

const escapeICS = (value = '') => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

const toICSDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
};

const foldICSLine = (line) => {
  const chunks = [];
  let current = '';
  let bytes = 0;
  for (const character of String(line)) {
    const charBytes = Buffer.byteLength(character, 'utf8');
    const limit = chunks.length === 0 ? 75 : 74;
    if (bytes + charBytes > limit && current) {
      chunks.push(current);
      current = ' ';
      bytes = 1;
    }
    current += character;
    bytes += charBytes;
  }
  if (current) chunks.push(current);
  return chunks.join('\r\n');
};

const buildEventICS = (qr) => {
  const payload = qr.payload || {};
  const start = toICSDate(payload.startDate);
  const end = toICSDate(payload.endDate);
  const stamp = toICSDate(qr.createdAt || new Date());
  const uid = qr.code || qr._id?.toString() || crypto.randomUUID();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LumaLink//Event QR//EN',
    'BEGIN:VEVENT',
    `UID:lumalink-${uid}@lumalink`,
    `DTSTAMP:${stamp}`,
    start ? `DTSTART:${start}` : '',
    end ? `DTEND:${end}` : '',
    `SUMMARY:${escapeICS(payload.eventTitle || qr.title || 'LumaLink Event')}`,
    payload.location ? `LOCATION:${escapeICS(payload.location)}` : '',
    payload.description ? `DESCRIPTION:${escapeICS(payload.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.map(foldICSLine).join('\r\n') + '\r\n';
};

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
      // Normalize custom aliases server-side as well: lowercase and remove whitespace.
      let requestedCode = typeof code === 'string' ? code.trim().toLowerCase().replace(/\s+/g, '') : '';
      if (requestedCode && !/^[a-z0-9_-]{3,40}$/.test(requestedCode)) {
        return res.status(400).json({ message: 'Alias must be 3–40 characters using lowercase letters, numbers, hyphens, or underscores. Spaces and uppercase letters are not allowed.' });
      }
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

      // Event QRs remain static: the iCalendar payload is embedded directly in the QR.
      // Do not turn Event records into redirects/landing pages.
      if (type === 'EVENT') {
        qrData.dynamic = false;
        delete qrData.code;
      }
    }

    let qr = await QR.create(qrData);

    if (type === 'EVENT') {
      qr.destination = buildEventICS(qr);
      await qr.save();
    }

    res.status(201).json(qr.toObject());
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
      const ip = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
      const userAgent = req.headers['user-agent'] || '';

      // Avoid double-counting the same physical scan.
      // Many mobile QR scanners / browsers fire the request twice within a couple of seconds.
      const recentWindowMs = 8000; // 8 seconds
      const recentCutoff = new Date(Date.now() - recentWindowMs);
      const recentDuplicate = await Analytics.findOne({
        qrId: qr._id,
        ip,
        scannedAt: { $gte: recentCutoff },
      }).lean();

      if (!recentDuplicate) {
        await Analytics.create({
          qrId: qr._id,
          ip,
          browser: userAgent,
          device: deviceBucket(userAgent),
          referrer: req.headers['referer'] || req.headers['referrer'],
        });

        // Increment click count only for a non-duplicate scan
        qr.clicks = (qr.clicks || 0) + 1;
        await qr.save();
      }

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
