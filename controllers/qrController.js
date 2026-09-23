const QR = require('../models/QR');
const Analytics = require('../models/Analytics');
const crypto = require('crypto');
const { deviceBucket } = require('./analyticsController');

const generateCode = () => crypto.randomBytes(4).toString('hex');

const getPublicBaseUrl = (req) => {
  const configured = process.env.PUBLIC_BASE_URL || process.env.PUBLIC_SHORT_URL_BASE;
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
};

const buildEventUrl = (req, code) => `${getPublicBaseUrl(req)}/event/${encodeURIComponent(code)}`;

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

const buildEventICS = (qr) => {
  const payload = qr.payload || {};
  const start = toICSDate(payload.startDate);
  const end = toICSDate(payload.endDate);
  const stamp = toICSDate(qr.createdAt || new Date());
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LumaLink//Event QR//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:lumalink-${qr.code}@lumalink`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${escapeICS(payload.eventTitle || qr.title || 'LumaLink Event')}`,
    start ? `DTSTART:${start}` : '',
    end ? `DTEND:${end}` : '',
    payload.location ? `LOCATION:${escapeICS(payload.location)}` : '',
    payload.description ? `DESCRIPTION:${escapeICS(payload.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n') + '\r\n';
};

const recordEventScan = async (qr, req) => {
  const ip = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  const recentCutoff = new Date(Date.now() - 8000);
  const recentDuplicate = await Analytics.findOne({ qrId: qr._id, ip, scannedAt: { $gte: recentCutoff } }).lean();
  if (!recentDuplicate) {
    await Analytics.create({ qrId: qr._id, ip, browser: userAgent, device: deviceBucket(userAgent), referrer: req.headers.referer || req.headers.referrer });
    qr.clicks = (qr.clicks || 0) + 1;
    await qr.save();
  }
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

      // Event QRs use a public HTTPS landing page instead of embedding raw iCalendar data.
      // This is much more consistent across Samsung/Android/iOS scanners and keeps the QR compact.
      if (type === 'EVENT') {
        qrData.destination = buildEventUrl(req, qrData.code);
      }
    }

    const qr = await QR.create(qrData);
    res.status(201).json({ ...qr.toObject(), publicUrl: type === 'EVENT' && qr.code ? buildEventUrl(req, qr.code) : undefined });
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

// @desc    Event QR landing page
// @route   GET /event/:code
// @access  Public
const eventLanding = async (req, res, next) => {
  try {
    if (req.params.code === 'preview') {
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none';");
      return res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LumaLink Event Preview</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:24px;box-sizing:border-box}.card{max-width:460px;background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.1);text-align:center}h1{font-size:24px;margin:0 0 10px}p{color:#64748b;line-height:1.6;font-size:14px}</style></head><body><div class="card"><h1>📅 Event QR Preview</h1><p>Create and save your event first. The saved QR will contain a short HTTPS event link that works with Samsung, Android and iPhone scanners.</p></div></body></html>`);
    }

    const qr = await QR.findOne({ code: req.params.code, type: 'EVENT' });
    if (!qr || qr.active === false) return res.status(404).send('This event QR code is inactive or unavailable.');

    await recordEventScan(qr, req);

    const payload = qr.payload || {};
    const title = payload.eventTitle || qr.title || 'LumaLink Event';
    const location = payload.location || '';
    const description = payload.description || '';
    const start = payload.startDate ? new Date(payload.startDate) : null;
    const end = payload.endDate ? new Date(payload.endDate) : null;
    const validStart = start && !Number.isNaN(start.getTime());
    const validEnd = end && !Number.isNaN(end.getTime());
    const icsUrl = `/event/${encodeURIComponent(qr.code)}.ics`;

    const googleParams = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      details: description,
      location,
      ...(validStart ? { dates: `${toICSDate(start)}/${validEnd ? toICSDate(end) : toICSDate(start)}` } : {}),
    });
    const googleUrl = `https://calendar.google.com/calendar/render?${googleParams.toString()}`;

    const escHtml = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const formatDate = (date) => date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'short', timeZoneName: 'short' }).format(date)
      : '';

    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://calendar.google.com;");
    res.setHeader('Cache-Control', 'no-store');
    return res.send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#4f46e5"><title>${escHtml(title)} — LumaLink</title>
<style>body{margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}.card{width:min(560px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:24px;box-shadow:0 18px 50px rgba(15,23,42,.12);overflow:hidden}.top{padding:28px 28px 22px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff}.brand{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.85}.title{font-size:30px;line-height:1.15;margin:12px 0 0}.body{padding:24px 28px}.row{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #eef2f7}.row:last-of-type{border-bottom:0}.icon{width:30px;flex:none;text-align:center}.label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:800}.value{margin-top:3px;font-size:15px;line-height:1.5;white-space:pre-wrap}.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}.btn{display:flex;align-items:center;justify-content:center;text-decoration:none;padding:13px 14px;border-radius:12px;font-weight:800;font-size:14px}.primary{background:#4f46e5;color:#fff}.secondary{background:#eef2ff;color:#4338ca}.note{margin-top:16px;font-size:11px;line-height:1.5;color:#64748b;text-align:center}@media(max-width:520px){.actions{grid-template-columns:1fr}.title{font-size:25px}.body,.top{padding-left:20px;padding-right:20px}}</style></head>
<body><main class="wrap"><section class="card"><header class="top"><div class="brand">LumaLink · Event</div><h1 class="title">${escHtml(title)}</h1></header><div class="body">
${validStart ? `<div class="row"><div class="icon">📅</div><div><div class="label">Date & time</div><div class="value">${escHtml(formatDate(start))}${validEnd ? ` — ${escHtml(formatDate(end))}` : ''}</div></div></div>` : ''}
${location ? `<div class="row"><div class="icon">📍</div><div><div class="label">Location</div><div class="value">${escHtml(location)}</div></div></div>` : ''}
${description ? `<div class="row"><div class="icon">📝</div><div><div class="label">Details</div><div class="value">${escHtml(description)}</div></div></div>` : ''}
<div class="actions"><a class="btn primary" href="${escHtml(icsUrl)}">📅 Add to Calendar</a><a class="btn secondary" href="${escHtml(googleUrl)}">Google Calendar</a></div><p class="note">This event page is designed for reliable QR scanning on Samsung, Android and iPhone. If your phone does not open the calendar automatically, download the .ics file and open it with your calendar app.</p>
</div></section></main></body></html>`);
  } catch (error) { next(error); }
};

// @desc    Download Event ICS file
// @route   GET /event/:code.ics
// @access  Public
const eventICS = async (req, res, next) => {
  try {
    const qr = await QR.findOne({ code: req.params.code, type: 'EVENT' });
    if (!qr || qr.active === false) return res.status(404).send('This event QR code is inactive or unavailable.');
    const ics = buildEventICS(qr);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent((qr.payload?.eventTitle || qr.title || 'event').replace(/[^a-z0-9_-]+/gi, '-')).slice(0, 80)}.ics"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(ics);
  } catch (error) { next(error); }
};

module.exports = {
  createQR,
  getQRs,
  getQRById,
  updateQR,
  toggleQR,
  deleteQR,
  dynamicRedirect,
  eventLanding,
  eventICS
};
