const leadStatuses = ['active', 'pending', 'contacted', 'qualified', 'viewing', 'negotiating', 'lost'];
// Retain the existing inactive state for partner customer records.
const partnerCustomerStatuses = [...leadStatuses.map(status => status.toUpperCase()), 'INACTIVE'];

module.exports = { leadStatuses, partnerCustomerStatuses };
