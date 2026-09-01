const crypto = require('crypto');
const ShortURL = require('../models/ShortURL');

const generateCode = () => crypto.randomBytes(4).toString('hex');

const isValidUrl = (value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

const getBaseUrl = (req) => {
  const configured = process.env.PUBLIC_SHORT_URL_BASE || process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
};

const serialize = (item, req) => ({
  ...item.toObject(),
  shortUrl: `${getBaseUrl(req)}/s/${item.code}`,
});

const createShortURL = async (req, res, next) => {
  try {
    const { title, url, alias } = req.body;
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const originalUrl = typeof url === 'string' ? url.trim() : '';
    const requestedAlias = typeof alias === 'string' ? alias.trim() : '';
    if (!cleanTitle) return res.status(400).json({ message: 'Title is required.' });
    if (!isValidUrl(originalUrl)) return res.status(400).json({ message: 'Enter a valid HTTP or HTTPS URL.' });
    if (requestedAlias && !/^[A-Za-z0-9_-]{3,40}$/.test(requestedAlias)) {
      return res.status(400).json({ message: 'Alias must be 3–40 characters using letters, numbers, hyphens, or underscores.' });
    }
    let code = requestedAlias;
    if (code) {
      if (await ShortURL.findOne({ code })) return res.status(409).json({ message: 'That alias is already in use. Choose another one.' });
    } else {
      do { code = generateCode(); } while (await ShortURL.exists({ code }));
    }
    const shortURL = await ShortURL.create({ title: cleanTitle, originalUrl, code, active: true });
    res.status(201).json(serialize(shortURL, req));
  } catch (error) { next(error); }
};

const getShortURLs = async (req, res, next) => {
  try {
    const urls = await ShortURL.find({}).sort({ createdAt: -1 });
    res.json(urls.map((item) => serialize(item, req)));
  } catch (error) { next(error); }
};

const updateShortURL = async (req, res, next) => {
  try {
    const item = await ShortURL.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Short URL not found.' });
    const { title, url, alias, active } = req.body;
    if (title !== undefined) {
      const cleanTitle = String(title).trim();
      if (!cleanTitle) return res.status(400).json({ message: 'Title is required.' });
      item.title = cleanTitle;
    }
    if (url !== undefined) {
      const cleanUrl = String(url).trim();
      if (!isValidUrl(cleanUrl)) return res.status(400).json({ message: 'Enter a valid HTTP or HTTPS URL.' });
      item.originalUrl = cleanUrl;
    }
    if (alias !== undefined && String(alias).trim() !== item.code) {
      const requestedAlias = String(alias).trim();
      if (!/^[A-Za-z0-9_-]{3,40}$/.test(requestedAlias)) return res.status(400).json({ message: 'Alias must be 3–40 characters using letters, numbers, hyphens, or underscores.' });
      if (await ShortURL.findOne({ code: requestedAlias, _id: { $ne: item._id } })) return res.status(409).json({ message: 'That alias is already in use.' });
      item.code = requestedAlias;
    }
    if (active !== undefined) item.active = Boolean(active);
    await item.save();
    res.json(serialize(item, req));
  } catch (error) { next(error); }
};

const toggleShortURL = async (req, res, next) => {
  try {
    const item = await ShortURL.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Short URL not found.' });
    item.active = !item.active;
    await item.save();
    res.json(serialize(item, req));
  } catch (error) { next(error); }
};

const deleteShortURL = async (req, res, next) => {
  try {
    const item = await ShortURL.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Short URL not found.' });
    await item.deleteOne();
    res.json({ message: 'Short URL deleted.' });
  } catch (error) { next(error); }
};

const shortRedirect = async (req, res, next) => {
  try {
    const item = await ShortURL.findOne({ code: req.params.code });
    if (!item) return res.status(404).send('Short URL not found.');
    if (!item.active) return res.status(410).send('This short URL is inactive.');
    item.clicks += 1;
    item.lastClickedAt = new Date();
    await item.save();
    return res.redirect(302, item.originalUrl);
  } catch (error) { next(error); }
};

module.exports = { createShortURL, getShortURLs, updateShortURL, toggleShortURL, deleteShortURL, shortRedirect };
