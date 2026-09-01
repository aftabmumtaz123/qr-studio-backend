const Analytics = require('../models/Analytics');
const QR = require('../models/QR');

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const getLast7Days = () => {
  const days = [];
  const today = startOfDay(new Date());
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    days.push(date);
  }
  return days;
};

const deviceBucket = (value = '') => {
  const ua = value.toLowerCase();
  if (!ua) return 'Unknown';
  if (/tablet|ipad|android(?!.*mobile)/i.test(ua)) return 'Tablet';
  if (/mobile|iphone|ipod|android/i.test(ua)) return 'Mobile';
  return 'Desktop';
};

// @desc Get basic analytics for a specific QR
// @route GET /api/analytics/:id
const getAnalytics = async (req, res, next) => {
  try {
    const totalScans = await Analytics.countDocuments({ qrId: req.params.id });
    const scansList = await Analytics.find({ qrId: req.params.id }).sort({ scannedAt: -1 }).limit(100);
    res.json({ totalScans, recentScans: scansList });
  } catch (error) {
    next(error);
  }
};

// @desc Get real dashboard analytics aggregated from QR + scan events
// @route GET /api/analytics/overview
const getOverview = async (req, res, next) => {
  try {
    const [qrs, totalScans, scanEvents, typeCounts, deviceCounts, countryCounts, dailyCounts] = await Promise.all([
      QR.find({}).sort({ createdAt: -1 }).lean(),
      Analytics.countDocuments({}),
      Analytics.find({}).sort({ scannedAt: -1 }).limit(500).lean(),
      QR.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Analytics.aggregate([
        { $project: { deviceGroup: { $cond: [
          { $and: [{ $ne: ['$device', null] }, { $ne: ['$device', ''] }] },
          '$device',
          { $cond: [
            { $regexMatch: { input: { $ifNull: ['$browser', ''] }, regex: /tablet|ipad|android(?!.*mobile)/i } }, 'Tablet',
            { $cond: [
              { $regexMatch: { input: { $ifNull: ['$browser', ''] }, regex: /mobile|iphone|ipod|android/i } }, 'Mobile', 'Desktop'
            ] }
          ] }
        ] } } },
        { $group: { _id: '$deviceGroup', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Analytics.aggregate([{ $group: { _id: { $ifNull: ['$country', 'Unknown'] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 6 }]),
      Analytics.aggregate([
        { $match: { scannedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0) - (6 * 24 * 60 * 60 * 1000)) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$scannedAt' } }, scans: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
    ]);

    const totalClicks = qrs.reduce((sum, qr) => sum + Number(qr.clicks || 0), 0);
    const activeLinks = qrs.filter((qr) => qr.dynamic).length;
    const scannedQrIds = new Set(scanEvents.map((event) => String(event.qrId)));
    const conversionRate = qrs.length ? (scannedQrIds.size / qrs.length) * 100 : 0;

    const days = getLast7Days();
    const dailyMap = new Map(dailyCounts.map((item) => [item._id, item.scans]));
    const clicksOverview = days.map((day) => {
      const date = day.toISOString().slice(0, 10);
      const scans = dailyMap.get(date) || 0;
      return {
        date,
        label: day.toLocaleDateString('en-US', { weekday: 'short' }),
        scans,
        clicks: scans,
      };
    });

    const devices = ['Mobile', 'Desktop', 'Tablet', 'Unknown'].map((name) => ({
      name,
      value: deviceCounts.find((item) => item._id === name)?.count || 0,
    })).filter((item) => item.value > 0);

    const recentActivity = [
      ...scanEvents.slice(0, 8).map((event) => {
        const qr = qrs.find((item) => String(item._id) === String(event.qrId));
        return {
          id: `scan-${event._id}`,
          type: 'scan',
          title: 'QR Code Scanned',
          description: qr?.title || 'QR code',
          date: event.scannedAt,
          location: [event.city, event.country].filter(Boolean).join(', ') || 'Location unavailable',
          device: deviceBucket(event.browser),
        };
      }),
      ...qrs.slice(0, 8).map((qr) => ({
        id: `create-${qr._id}`,
        type: 'created',
        title: 'QR Code Created',
        description: qr.title,
        date: qr.createdAt,
        location: qr.type || 'QR',
        device: null,
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    res.json({
      summary: {
        totalClicks,
        totalScans,
        totalQrCodes: qrs.length,
        activeLinks,
        conversionRate: Number(conversionRate.toFixed(2)),
      },
      clicksOverview,
      topLinks: qrs.slice().sort((a, b) => Number(b.clicks || 0) - Number(a.clicks || 0)).slice(0, 6).map((qr) => ({
        id: qr._id,
        title: qr.title,
        type: qr.type,
        clicks: Number(qr.clicks || 0),
        code: qr.code || null,
      })),
      qrDistribution: typeCounts.map((item) => ({ name: item._id || 'Unknown', value: item.count })),
      recentLinks: qrs.slice(0, 6).map((qr) => ({
        id: qr._id,
        title: qr.title,
        type: qr.type,
        code: qr.code || null,
        clicks: Number(qr.clicks || 0),
        createdAt: qr.createdAt,
        dynamic: Boolean(qr.dynamic),
      })),
      recentActivity,
      devices,
      countries: countryCounts.map((item) => ({ name: item._id, value: item.count })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAnalytics, getOverview, deviceBucket };
