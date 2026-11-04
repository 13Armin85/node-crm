const Opportunity = require('../model/schema/opprtunity');
const { outcome } = require('./opportunityMetrics');
const { readScope } = require('./recordAccess');
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
  const records = await Opportunity.find(readScope(req, req.actor, 'Opportunities', { deleted:false, ...currencyMatch, $expr:{$and:[{$gte:[date,earliest]},{$lte:[date,now]}]} })).select('salesStage commission amount opportunityAmount closedAt createdDate assignUser createBy').lean();
  const buckets = Object.fromEntries(['sold','available','lost','total'].map(key => [key,{count:0,values:[{currency,amount:0}]}]));
  const sellers = new Map();
  for (const record of records) {
    const effective = new Date(record.closedAt || record.createdDate), commission = Math.max(0, Number(record.commission) || 0);
    const state = outcome(record.salesStage), key = state === 'won' ? 'sold' : state === 'lost' ? 'lost' : 'available';
    if (effective >= start) for (const name of [key,'total']) { buckets[name].count++; buckets[name].values[0].amount += commission; }
    if (state === 'won' && effective >= teamStart) {
      const userId = String(record.assignUser || record.createBy || ''); if (!userId) continue;
      const seller = sellers.get(userId) || {userId,soldCount:0,commission:0,salesAmount:0};
      seller.soldCount++; seller.commission += commission; seller.salesAmount += Math.max(0,Number(record.amount ?? record.opportunityAmount)||0); sellers.set(userId,seller);
    }
  }
  const users = await require('../model/schema/user').find({_id:{$in:[...sellers.keys()]}}).select('firstName lastName username').lean();
  const names = new Map(users.map(user=>[String(user._id), [user.firstName,user.lastName].filter(Boolean).join(' ') || user.username]));
  const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
  for (const bucket of Object.values(buckets)) bucket.values[0].amount = round(bucket.values[0].amount);
  const bySeller = [...sellers.values()].sort((a,b)=>b.commission-a.commission || b.soldCount-a.soldCount || a.userId.localeCompare(b.userId)).map((person,index)=>({...person,commission:round(person.commission),salesAmount:round(person.salesAmount),rank:index+1,name:names.get(person.userId)||'',values:[{currency,amount:round(person.commission)}],salesValues:[{currency,amount:round(person.salesAmount)}]}));
  return {...buckets,bySeller,period,teamMonths,currency,start,teamStart,end:now};
}
module.exports = { commissionSummary, since };
