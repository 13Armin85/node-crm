const { Property } = require('../model/schema/property');
const Opportunity = require('../model/schema/opprtunity');
const { readScope } = require('./recordAccess');
const { reportTimeoutMS } = require('../config/runtime');
const { since } = require('./commissionSummary');

const currency = { $let: { vars: { code: { $toUpper: { $ifNull: ['$price.currency', 'TRY'] } } }, in: { $cond: [{ $in: ['$$code', ['', 'TRY']] }, 'TRY', { $cond: [{ $eq: ['$$code', { $literal: '$' }] }, 'USD', '$$code'] }] } } };
const amount = input => ({ $max: [0, { $convert: { input, to: 'double', onError: 0, onNull: 0 } }] });
const group = { $group: { _id: { bucket: '$bucket', currency: '$currency' }, count: { $sum: 1 }, amount: { $sum: '$amount' } } };

async function dashboardFinance(req) {
  const period = req.query?.period || 'all';
  if (!['all', 'week', 'month', 'half', 'year'].includes(period)) throw Object.assign(new Error('invalid'), { status: 400, code: 'invalid' });
  const now = new Date();
  const dateMatch = period === 'all' ? {} : { $or: [
    { closedAt: { $gte: since(now, period), $lte: now } },
    { closedAt: null, createdDate: { $gte: since(now, period), $lte: now } },
  ] };
  const [properties, income] = await Promise.all([
    Property.aggregate([
      { $match: readScope(req, req.actor, 'Properties', { deleted: false }) },
      { $project: {
        bucket: { $cond: [{ $eq: ['$sale.status', 'SOLD'] }, 'soldProperties', 'unsoldProperties'] },
        currency, amount: amount('$price.amount'),
      } }, group,
    ]).option({ maxTimeMS: reportTimeoutMS }),
    Opportunity.aggregate([
      { $match: readScope(req, req.actor, 'Opportunities', { deleted: false, ...dateMatch }) },
      { $project: {
        bucket: { $switch: { branches: [
          { case: { $regexMatch: { input: { $ifNull: ['$salesStage', ''] }, regex: /(^|[/\s_-])(won|win|sold)$/i } }, then: 'successfulIncome' },
          { case: { $regexMatch: { input: { $ifNull: ['$salesStage', ''] }, regex: /(^|[/\s_-])(lost|loss)$/i } }, then: 'lostIncome' },
        ], default: null } },
        currency: { $cond: [{ $in: ['$currency', { $literal: ['USD', '$'] }] }, 'USD', { $cond: [{ $eq: ['$currency', 'EUR'] }, 'EUR', 'TRY'] }] },
        amount: amount('$commission'),
      } },
      { $match: { bucket: { $ne: null } } }, group,
    ]).option({ maxTimeMS: reportTimeoutMS }),
  ]);
  const result = Object.fromEntries(['soldProperties', 'successfulIncome', 'lostIncome', 'unsoldProperties'].map(key => [key, { count: 0, values: [] }]));
  for (const row of [...properties, ...income]) {
    result[row._id.bucket].count += row.count;
    result[row._id.bucket].values.push({ currency: row._id.currency, amount: Math.round((row.amount + Number.EPSILON) * 100) / 100 });
  }
  return result;
}
module.exports = { dashboardFinance };
