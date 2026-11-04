const { reportTimeoutMS } = require('../config/runtime');
const DAY_MS = 86400000;
// Bound the response size as well as the database work. Ten years of daily
// history remains available; larger histories can be requested in windows.
const MAX_DAYS = 3660;

function dateRange(body = {}) {
  const parse = (value, suffix) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return null;
    const result = new Date(value + suffix);
    return Number.isFinite(result.getTime()) && result.toISOString().slice(0, 10) === value ? result : null;
  };
  const start = parse(body.startDate, 'T00:00:00.000Z');
  const end = parse(body.endDate, 'T23:59:59.999Z');
  if (!start || !end || start > end || (end - start + 1) / DAY_MS > MAX_DAYS) return null;
  return { start, end };
}

function startOfWeek(value) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() || 7) + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function buildBuckets(start, end, weekly) {
  const result = [];
  const cursor = weekly ? startOfWeek(start) : new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + (weekly ? 7 : 1));
  }
  return result;
}

async function aggregateTimeline(Model, match, weekly) {
  // Use date arithmetic supported by the existing MongoDB deployment. Monday
  // buckets match the previous UTC implementation, including year boundaries.
  const day = { $dateFromParts: { year: { $year: '$timestamp' }, month: { $month: '$timestamp' }, day: { $dayOfMonth: '$timestamp' } } };
  const date = weekly ? { $subtract: [day, { $multiply: [{ $mod: [{ $add: [{ $dayOfWeek: '$timestamp' }, 5] }, 7] }, DAY_MS] }] } : day;
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date, timezone: 'UTC' } }, count: { $sum: 1 } } },
  ]).option({ maxTimeMS: reportTimeoutMS });
  return { counts: new Map(rows.map(row => [row._id, row.count])), total: rows.reduce((sum, row) => sum + row.count, 0) };
}

module.exports = { dateRange, buildBuckets, aggregateTimeline };
