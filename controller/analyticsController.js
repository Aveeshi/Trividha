const AnalyticsModel = require('../model/analyticsModel');

exports.daily = async (req, res) => {
  try {
    const days = Math.max(1, Math.min(90, Number(req.query.days) || 14));
    const { dates, series } = await AnalyticsModel.dailySeries(req.hospitalId, days);
    res.json({ dates, series });
  } catch (err) {
    console.error('Analytics daily error:', err);
    res.status(500).json({ error: 'Could not load analytics.' });
  }
};

exports.visits = async (req, res) => {
  try {
    const days = Math.max(1, Math.min(90, Number(req.query.days) || 14));
    const visits = await AnalyticsModel.recentVisits(req.hospitalId, days);
    res.json({ visits });
  } catch (err) {
    console.error('Analytics visits error:', err);
    res.status(500).json({ error: 'Could not load recent visits.' });
  }
};

exports.recordVisit = async (req, res) => {
  res.status(501).json({
    error: 'Manual visit entry is no longer available -- visit counts now come from completed appointments.'
  });
};
