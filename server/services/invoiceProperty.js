const { Property } = require('../model/schema/property');
const { readScope } = require('./recordAccess');
const { objectId, fail } = require('./estateValidation');
async function validateInvoiceProperty(req, body, previous = {}) {
  const property = body.property !== undefined ? body.property : previous.property;
  const transactionType = body.transactionType !== undefined ? body.transactionType : previous.transactionType;
  if (transactionType && !['SALE', 'RENT'].includes(transactionType)) fail('transactionType');
  if (!property) return;
  if (!objectId(String(property))) fail('property');
  if (!transactionType) fail('transactionType', 'required');
  if (String(property) !== String(previous.property || '')) {
    if (!await Property.exists(readScope(req, req.actor, 'Properties', { _id: property, deleted: false }))) fail('property', 'relationNotFound');
  }
}
module.exports = { validateInvoiceProperty };
