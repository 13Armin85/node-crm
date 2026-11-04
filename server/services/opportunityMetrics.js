const { fail } = require('./estateValidation');
const defaultStages = ['Prospecting', 'Qualification', 'Needs Analysis', 'Value Proposition', 'Identifying Decision Makers', 'Perception Analysis', 'Proposal/Price Quote', 'Negotiation/Review', 'Closed/Won', 'Closed/Lost'];
const outcome = value => /(^|[/\s_-])(won|win|sold)$/i.test(String(value || '')) ? 'won' : /(^|[/\s_-])(lost|loss)$/i.test(String(value || '')) ? 'lost' : 'open';
const stageProbability = (stage, stages = defaultStages) => {
  if (outcome(stage) === 'won') return 100;
  if (outcome(stage) === 'lost') return 0;
  const open = stages.map(item => typeof item === 'string' ? item : item.value).filter(value => outcome(value) === 'open');
  const index = open.indexOf(stage);
  return index < 0 ? 0 : open.length < 2 ? 10 : Math.round(10 + index * 80 / (open.length - 1));
};
const inferLeadStage = record => record.leadStage || record.leadData?.leadState || record.leadData?.leadStatus
  || record.convertedLeads?.find(item => item.values?.leadState)?.values?.leadState
  || record.convertedLeads?.find(item => item.values?.leadStatus)?.values?.leadStatus
  || record.contactData?.convertedLeads?.find(item => item.values?.leadState)?.values?.leadState
  || record.contactData?.convertedLeads?.find(item => item.values?.leadStatus)?.values?.leadStatus
  || record.contactData?.state || record.convertedContacts?.find(item=>item.values?.state)?.values?.state || '';
function normalizeOpportunity(body, previous = {}, definition, requireAmounts = false) {
  const result = { ...body };
  delete result.closedAt;
  for (const field of ['opportunityAmount', 'amount', 'commission']) {
    const value = body[field];
    if (value === undefined || value === null || value === '') {
      if (requireAmounts || value !== undefined) fail(field, 'required');
    } else {
      const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
      if (!Number.isFinite(number) || number < 0) fail(field);
      result[field] = number;
    }
  }
  if (body.currency !== undefined && !['TRY', 'USD', 'EUR', '$'].includes(body.currency)) fail('currency');
  if (body.currency === '$') result.currency = 'USD';
  if (!previous._id && body.currency === undefined) result.currency = 'TRY';
  const stages = definition?.fields.find(field => field.name === 'salesStage')?.options || defaultStages;
  const stage = body.salesStage ?? previous.salesStage ?? (typeof stages[0] === 'string' ? stages[0] : stages[0]?.value) ?? 'Prospecting';
  if ((!previous._id || body.salesStage !== undefined) && !stages.some(item => (typeof item === 'string' ? item : item.value) === stage)) fail('salesStage');
  result.salesStage = stage;
  result.probability = stageProbability(stage, stages);
  if (body.leadStage && !definition?.fields.find(field=>field.name==='leadStage')?.options?.some(option=>option.value===body.leadStage)) fail('leadStage');
  if (outcome(stage) !== 'open' && (!previous._id || previous.salesStage !== stage)) result.closedAt = new Date();
  else if (outcome(stage) === 'open' && previous.closedAt) result.closedAt = null;
  if (body.leadStage === undefined && !previous._id) result.leadStage = inferLeadStage(body) || 'Open';
  return result;
}
function decorateOpportunity(record, definition) {
  return { ...record, leadStage: inferLeadStage(record), probability: stageProbability(record.salesStage, definition?.fields.find(field => field.name === 'salesStage')?.options) };
}
module.exports = { defaultStages, outcome, stageProbability, normalizeOpportunity, decorateOpportunity, inferLeadStage };
