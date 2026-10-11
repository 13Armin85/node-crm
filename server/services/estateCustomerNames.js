const { Lead } = require('../model/schema/lead');
const PartnerCustomer = require('../model/schema/partnerCustomer');
const { readScope } = require('./recordAccess');

async function withCustomerNames(req, records) {
  const rows = Array.isArray(records) ? records : [records];
  const names = new Map();
  for (const { type, field, moduleName, model, select } of [
    { type: 'LEAD', field: 'lead', moduleName: 'Leads', model: Lead, select: 'leadName leadEmail' },
    { type: 'PARTNER_CUSTOMER', field: 'partnerCustomer', moduleName: 'Partner Customers', model: PartnerCustomer, select: 'fullName companyName customerType' },
  ]) {
    const ids = [...new Set(rows.filter(row => ['SOLD', 'RENTED'].includes(row.sale?.status) && row.sale.buyerType === type && row.sale[field]).map(row => String(row.sale[field])))];
    if (!ids.length) continue;
    const customers = await model.find(readScope(req, req.actor, moduleName, { _id: { $in: ids }, deleted: false })).select(select).lean();
    for (const customer of customers) names.set(type + ':' + customer._id,
      type === 'LEAD' ? customer.leadName || customer.leadEmail : customer.customerType === 'COMPANY' ? customer.companyName : customer.fullName);
  }
  const result = rows.map(row => {
    if (!['SOLD', 'RENTED'].includes(row.sale?.status)) return row;
    const id = row.sale.buyerType === 'LEAD' ? row.sale.lead : row.sale.partnerCustomer;
    return { ...row, sale: { ...row.sale, customerName: names.get(row.sale.buyerType + ':' + id) || null } };
  });
  return Array.isArray(records) ? result : result[0];
}
module.exports = { withCustomerNames };
