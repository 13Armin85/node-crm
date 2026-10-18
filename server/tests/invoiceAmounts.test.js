const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateInvoice, invoiceNumber } = require('../../client/src/utils/invoiceCalculations');
const { normalizeInvoiceAmounts } = require('../services/invoiceAmounts');

test('line discounts reduce the KDV base once; shipping is taxable', () => {
  const result = calculateInvoice({ items: [
    { qty: '2', rate: '100', discountType: 'percent', discount: '10' },
    { qty: 1, rate: 50, discountType: 'flatAmount', discount: 5 },
  ], shipping: 10, ptax: 20 });
  assert.deepEqual([result.total, result.discount, result.subtotal, result.shippingTax, result.tax, result.grandTotal], [250, 25, 225, 235, 47, 282]);
  assert.deepEqual(result.items.map(item => item.amount), [180, 45]);
  const removed = calculateInvoice({ ...result, items: [result.items[1]] });
  assert.deepEqual([removed.total, removed.discount, removed.subtotal, removed.tax, removed.grandTotal], [50, 5, 45, 11, 66]);
});
test('kurus rounding and Turkish/Persian decimal input do not concatenate amounts', () => {
  assert.equal(invoiceNumber('1.234,56'), 1234.56);
  assert.equal(invoiceNumber('۱۲۳٫۴۵'), 123.45);
  const result = calculateInvoice({ items: [{ qty: 3, rate: 0.1 }, { qty: 1, rate: 0.2 }], ptax: 10 });
  assert.equal(result.total, 0.5); assert.equal(result.grandTotal, 0.55);
  assert.equal(calculateInvoice().grandTotal, 0);
  assert.equal(calculateInvoice().ptax, 20);
  assert.equal(calculateInvoice({ items: [{ qty: 1, rate: 10.075 }] }).total, 10.08);
});
test('API ignores tampered totals and recalculates partial edits from stored rows', () => {
  const previous = { currency: 'TRY', items: [{ qty: 2, rate: 100, discount: 10, discountType: 'Percentage' }], ptax: 20, shipping: 10 };
  const result = normalizeInvoiceAmounts({ shipping: 0, grandTotal: -1, total: 9999 }, previous);
  assert.equal(result.grandTotal, 216); assert.equal(result.total, 200);
  assert.equal(result.items[0].discountType, 'percent');
  assert.equal(normalizeInvoiceAmounts({ items: [], shipping: 0 }, previous).grandTotal, 0);
});
test('API validates invoice values and retains historical KDV only on historical invoices', () => {
  for (const body of [{ shipping: -1 }, { ptax: 18 }, { currency: 'BAD' }, { billingPostalCode: '123456' },
    { items: [{ qty: 1, rate: 100, discount: 101, discountType: 'percent' }] },
    { items: [{ qty: 1, rate: 100, discount: 101, discountType: 'flatAmount' }] },
    { items: [{ qty: 'invalid', rate: 100 }] }]) {
    assert.throws(() => normalizeInvoiceAmounts(body), { code: 'invalid' });
  }
  for (const ptax of [0, 1, 10, 20]) assert.equal(normalizeInvoiceAmounts({ ptax }).ptax, ptax);
  assert.equal(normalizeInvoiceAmounts({ title: 'Changed' }, { ptax: '18' }).ptax, 18);
  assert.equal(normalizeInvoiceAmounts({ ptax: 18, invoiceDate: '2023-07-09' }).ptax, 18);
  const copied = normalizeInvoiceAmounts({ isCheck: true, billingStreet: 'New address', billingPostalCode: '34000', shippingPostalCode: '35000' });
  assert.equal(copied.shippingStreet, 'New address'); assert.equal(copied.shippingPostalCode, '34000');
});

test('invoice model validation recalculates persisted values for imports and quote conversions', async () => {
  const Invoices = require('../model/schema/invoices');
  const actor = '64d33173fd7ff3fa0924a101';
  const invoice = new Invoices({ createBy: actor, modifiedBy: actor, ptax: '20', currency: 'TRY',
    items: [{ qty: 2, rate: 100, discount: 10, discountType: 'percent' }], grandTotal: '9999' });
  await invoice.validate();
  assert.equal(invoice.grandTotal, '216');
  assert.equal(invoice.subtotal, '180');
  assert.equal(invoice.items[0].amount, 180);
  const invalid = new Invoices({ createBy: actor, modifiedBy: actor, shipping: '-1' });
  await assert.rejects(invalid.validate(), { field: 'shipping', code: 'invalid' });
});

test('saved generated invoice labels are repaired while custom administrator labels survive', async t => {
  const { getDefinition, defaults } = require('../services/formDefinitions');
  const CustomField = require('../model/schema/customField');
  const FormDefinition = require('../model/schema/formDefinition');
  t.mock.method(CustomField, 'findOne', () => ({ lean: async () => null }));
  const fields = [
    { ...defaults.Invoices.find(field => field.name === 'shippingTax'), label: { en: 'shipping Tax', fa: 'shippingTax', tr: 'shipping Tax' } },
    { ...defaults.Invoices.find(field => field.name === 'billingStreet'), label: { en: 'billing Street', fa: 'Custom address label', tr: 'billing Street' } },
  ];
  t.mock.method(FormDefinition, 'findOne', () => ({ lean: async () => ({ moduleName: 'Invoices', fields }) }));
  const definition = await getDefinition('Invoices');
  assert.equal(definition.fields.find(field => field.name === 'shippingTax').label.en, 'KDV Matrahı');
  assert.equal(definition.fields.find(field => field.name === 'billingStreet').label.en, 'Billing Street');
  assert.equal(definition.fields.find(field => field.name === 'billingStreet').label.fa, 'Custom address label');
});
