const Opportunity = require('../model/schema/opprtunity');
const { readScope } = require('./recordAccess');
const { reportTimeoutMS } = require('../config/runtime');
const currencies = ['TRY', 'USD', 'EUR'];
function since(now, period) {
  const date = new Date(now);
  if (period === 'week') date.setUTCDate(date.getUTCDate() - 7);
  else {
    const months = { month: 1, quarter: 3, half: 6, year: 12 }[period];
    if (!months) throw Object.assign(new Error('invalid'), { status: 400, code: 'invalid' });
    const day = date.getUTCDate(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - months);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(); date.setUTCDate(Math.min(day, last));
  }
  return date;
}
async function commissionSummary(req, now = new Date()) {
  const period = req.query.period || 'year', teamMonths = Number(req.query.teamMonths || 3), currency = req.query.currency || 'TRY';
  if (!['week', 'month', 'half', 'year'].includes(period) || ![3,6,12].includes(teamMonths) || !currencies.includes(currency)) throw Object.assign(new Error('invalid'), {status:400,code:'invalid'});
  const start = since(now, period), teamStart = since(now, {3:'quarter',6:'half',12:'year'}[teamMonths]);
  const earliest = start < teamStart ? start : teamStart;
  const date = { $ifNull: ['$closedAt', '$createdDate'] };
  const currencyMatch = currency === 'TRY' ? { $or:[{currency:'TRY'},{currency:null},{currency:''}] } : currency === 'USD' ? {currency:{$in:['USD','$']}} : {currency};
  // Separate the fallback date branches so MongoDB can use their range indexes.
  const match = readScope(req, req.actor, 'Opportunities', { deleted: false, $and: [currencyMatch, { $or: [
    { closedAt: { $gte: earliest, $lte: now } },
    { closedAt: null, createdDate: { $gte: earliest, $lte: now } },
  ] }] });
  const nonnegative = input => ({ $max: [0, { $convert: { input, to: 'double', onError: 0, onNull: 0 } }] });
  const stage = { $convert: { input: '$salesStage', to: 'string', onError: '', onNull: '' } };
  const [summary] = await Opportunity.aggregate([
    { $match: match },
    { $project: {
      effectiveDate: date,
      commission: nonnegative('$commission'),
      salesAmount: nonnegative({ $ifNull: ['$amount', '$opportunityAmount'] }),
      userId: { $ifNull: ['$assignUser', '$createBy'] },
      state: { $switch: { branches: [
        { case: { $regexMatch: { input: stage, regex: /(^|[/\s_-])(won|win|sold)$/i } }, then: 'sold' },
        { case: { $regexMatch: { input: stage, regex: /(^|[/\s_-])(lost|loss)$/i } }, then: 'lost' },
      ], default: 'available' } },
    } },
    { $facet: {
      buckets: [
        { $match: { effectiveDate: { $gte: start } } },
        { $group: { _id: '$state', count: { $sum: 1 }, amount: { $sum: '$commission' } } },
      ],
      sellers: [
        { $match: { state: 'sold', effectiveDate: { $gte: teamStart }, userId: { $ne: null } } },
        { $group: { _id: '$userId', soldCount: { $sum: 1 }, commission: { $sum: '$commission' }, salesAmount: { $sum: '$salesAmount' } } },
      ],
    } },
  ]).option({ maxTimeMS: reportTimeoutMS });
  const buckets = Object.fromEntries(['sold','available','lost','total'].map(key => [key,{count:0,values:[{currency,amount:0}]}]));
  for (const bucket of summary?.buckets || []) {
    buckets[bucket._id].count = bucket.count;
    buckets[bucket._id].values[0].amount = bucket.amount;
    buckets.total.count += bucket.count;
    buckets.total.values[0].amount += bucket.amount;
  }
  const sellers = (summary?.sellers || []).map(({ _id, ...seller }) => ({ userId: String(_id), ...seller }));
  const ids = sellers.map(seller => seller.userId).filter(id => /^[a-f\d]{24}$/i.test(id));
  const users = ids.length ? await require('../model/schema/user').find({_id:{$in:ids}}).select('firstName lastName username').lean() : [];
  const names = new Map(users.map(user=>[String(user._id), [user.firstName,user.lastName].filter(Boolean).join(' ') || user.username]));
  const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
  for (const bucket of Object.values(buckets)) bucket.values[0].amount = round(bucket.values[0].amount);
  const bySeller = sellers.sort((a,b)=>b.commission-a.commission || b.soldCount-a.soldCount || a.userId.localeCompare(b.userId)).map((person,index)=>({...person,commission:round(person.commission),salesAmount:round(person.salesAmount),rank:index+1,name:names.get(person.userId)||'',values:[{currency,amount:round(person.commission)}],salesValues:[{currency,amount:round(person.salesAmount)}]}));
  return {...buckets,bySeller,period,teamMonths,currency,start,teamStart,end:now};
}
module.exports = { commissionSummary, since };
