const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeProperty, validateFields, validateDefinition } = require('../services/estateValidation');
const { defaults } = require('../services/formDefinitions');
const { mapProperty } = require('../scripts/migrate-estate');
const { can } = require('../middelwares/permissions');
const id = '64d33173fd7ff3fa0924a109';
const base = () => ({ title: 'Test', category: 'RESIDENTIAL', subtype: 'APARTMENT', transactionType: 'SALE', price: { amount: 0, currency: 'TRY' }, area: { value: 50, type: 'NET' }, sale: { status: 'AVAILABLE' } });
for (const [category, subtype, valid] of [['RESIDENTIAL', 'APARTMENT', true], ['RESIDENTIAL', 'VILLA', true], ['RESIDENTIAL', 'SHOP', false], ['COMMERCIAL', 'SHOP', true], ['COMMERCIAL', 'OFFICE', true], ['COMMERCIAL', 'APARTMENT', false]]) {
  test(`${category} / ${subtype}`, () => valid ? assert.equal(normalizeProperty({ ...base(), category, subtype }).subtype, subtype) : assert.throws(() => normalizeProperty({ ...base(), category, subtype })));
}
test('dependent fields clear when the parent changes', () => {
  const p = normalizeProperty({ ...base(), category: 'COMMERCIAL', subtype: 'SHOP', bedroom: '1+1', isInsideResidence: false, residence: id, sale: { status: 'AVAILABLE', lead: id, buyerType: 'LEAD' } });
  assert.equal(p.residence, null); assert.equal(p.bedroom, null); assert.equal(p.sale.lead, null); assert.equal(p.sale.buyerType, null);
});
test('sold property requires a valid buyer and only retains the selected relation', () => {
  for (const buyerType of ['LEAD', 'PARTNER_CUSTOMER']) {
    assert.throws(() => normalizeProperty({ ...base(), sale: { status: 'SOLD', buyerType } }));
    const sale = normalizeProperty({ ...base(), sale: { status: 'SOLD', buyerType, lead: id, partnerCustomer: id } }).sale;
    assert.equal(sale[buyerType === 'LEAD' ? 'lead' : 'partnerCustomer'], id);
    assert.equal(sale[buyerType === 'LEAD' ? 'partnerCustomer' : 'lead'], null);
  }
  assert.throws(() => normalizeProperty({ ...base(), sale: { status: 'SOLD' } }));
});
test('price and area enforce numeric bounds and stable enums', () => {
  for (const amount of [-1, NaN, Infinity, '1']) assert.throws(() => normalizeProperty({ ...base(), price: { amount, currency: 'TRY' } }));
  for (const value of [0, -1, NaN]) assert.throws(() => normalizeProperty({ ...base(), area: { value, type: 'NET' } }));
  assert.throws(() => normalizeProperty({ ...base(), area: { value: 1, type: 'OTHER' } }));
  assert.throws(() => normalizeProperty({ ...base(), isInsideResidence: true }));
});
const custom = { name: 'field_test', kind: 'CUSTOM_FIELD', type: 'text', enabled: true, label: { en: 'Test', fa: 'آزمون', tr: 'Deneme' }, required: true };
test('custom fields validate required values and reject injection keys', () => {
  assert.throws(() => validateFields({ fields: [custom] }, {}));
  const result = validateFields({ fields: [custom] }, { customFields: { field_test: 'value', unknown: 'discard' }, createBy: id });
  assert.deepEqual(result, { customFields: { field_test: 'value' } });
  assert.throws(() => validateFields({ fields: [{ ...custom, name: '__proto__' }] }, {}));
});
test('builder adds, edits, reorders and removes custom fields while protecting system fields', () => {
  const baseline = { fields: defaults.Properties }; const current = { ...baseline };
  const added = validateDefinition({ fields: [...baseline.fields, custom] }, current, baseline);
  assert.equal(added.at(-1).label.fa, 'آزمون');
  const edited = validateDefinition({ fields: [{ ...custom, label: { ...custom.label, en: 'Changed' } }, ...baseline.fields] }, { fields: added }, baseline);
  assert.equal(edited[0].order, 0); assert.equal(edited[0].label.en, 'Changed');
  assert.equal(validateDefinition(baseline, { fields: edited }, baseline).length, baseline.fields.length);
  assert.throws(() => validateDefinition({ fields: [] }, current, baseline));
  assert.throws(() => validateDefinition({ fields: [...baseline.fields, { ...custom, label: { en: 'Only' } }] }, current, baseline));
});
test('migration preserves explicit values and reports unknown types', () => {
  assert.deepEqual(mapProperty({ category: 'COMMERCIAL', propertyType: 'Apartment', price: { amount: 10 }, listingPrice: 20 }).update, {});
  assert.equal(mapProperty({ propertyType: 'Unknown' }).unknown, 'Unknown');
  assert.equal(mapProperty({ propertyType: 'Apartment for rent' }).update.transactionType, 'RENT');
});
test('fixed admin and user roles govern modules', () => {
  assert.equal(can({ role: 'user' }, 'Partner Customers', 'view'), true);
  assert.equal(can({ role: 'user' }, 'Properties', 'create'), true);
  assert.equal(can({ role: 'user' }, 'Users', 'view'), false);
  assert.equal(can({ role: 'admin' }, 'Residences', 'delete'), true);
});
