const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Property } = require('../model/schema/property');
const { validateInvoiceProperty } = require('../services/invoiceProperty');
const id = '64d33173fd7ff3fa0924a109';
const req = { actor: { role: 'admin', _id: id } };
test('property invoices require a valid transaction and an accessible property', async t => {
  const lookup = t.mock.method(Property, 'exists', async () => true);
  await assert.rejects(validateInvoiceProperty(req, { property: id }), { field: 'transactionType', code: 'required' });
  await assert.rejects(validateInvoiceProperty(req, { property: 'invalid', transactionType: 'RENT' }), { field: 'property' });
  await assert.rejects(validateInvoiceProperty(req, { property: id, transactionType: 'OTHER' }), { field: 'transactionType' });
  for (const transactionType of ['SALE', 'RENT']) await validateInvoiceProperty(req, { property: id, transactionType });
  assert.equal(lookup.mock.callCount(), 2);
  t.mock.method(Property, 'exists', async () => false);
  await assert.rejects(validateInvoiceProperty(req, { property: id, transactionType: 'SALE' }), { field: 'property', code: 'relationNotFound' });
  await validateInvoiceProperty(req, { title: 'An unrelated edit' }, { property: id, transactionType: 'RENT' });
  await validateInvoiceProperty(req, { title: 'Legacy invoice' });
});
