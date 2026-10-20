const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeProperty, validateFields, validateDefinition } = require('../services/estateValidation');
const { defaults } = require('../services/formDefinitions');
const { mapProperty } = require('../scripts/migrate-estate');
const { can } = require('../middelwares/permissions');
const id = '64d33173fd7ff3fa0924a109';

test('lead and partner customer statuses share the customer follow-up stages', () => {
  const leadOptions = defaults.Leads.find(field => field.name === 'leadStatus').options;
  const partnerOptions = defaults['Partner Customers'].find(field => field.name === 'status').options;
  assert.deepEqual(leadOptions.map(option => option.value), ['active', 'pending', 'contacted', 'qualified', 'viewing', 'negotiating', 'lost']);
  assert.deepEqual(partnerOptions.filter(option => option.value !== 'INACTIVE').map(option => option.label), leadOptions.map(option => option.label));
  const PartnerCustomer = require('../model/schema/partnerCustomer');
  for (const option of partnerOptions) {
    const customer = { customerType: 'INDIVIDUAL', fullName: 'Customer', status: option.value, createBy: id };
    assert.equal(validateFields({ fields: defaults['Partner Customers'] }, customer).status, option.value);
    assert.equal(new PartnerCustomer(customer).validateSync(), undefined);
  }
  for (const status of ['sold', 'rented']) {
    assert.throws(() => validateFields({ fields: defaults.Leads }, { leadName: 'Lead', leadEmail: 'lead@example.com', leadStatus: status }), { field: 'leadStatus', code: 'invalid' });
    assert.throws(() => validateFields({ fields: defaults['Partner Customers'] }, { customerType: 'INDIVIDUAL', fullName: 'Customer', status: status.toUpperCase() }), { field: 'status', code: 'invalid' });
  }
});
test('residence details validate counts, amenities, fees and optional legacy fields', () => {
  const fields = defaults.Residences;
  const values = { name: 'Residence', city: 'Istanbul', constructionStatus: 'READY', constructionYear: 2020,
    blockCount: 2, floorCount: 10, unitCount: 100, parkingCapacity: 0, totalArea: 2500,
    amenities: ['POOL', 'SECURITY'], unitTypes: ['1+1', '1+3'], maintenanceFee: { amount: 0, currency: 'USD' },
    phone: '+905551112233', email: 'management@example.com', mapUrl: 'https://example.com/map' };
  const validated = validateFields({ fields }, values);
  assert.equal(validated.unitCount, 100); assert.deepEqual(validated.amenities, ['POOL', 'SECURITY']);
  assert.deepEqual(validated.maintenanceFee, { amount: 0, currency: 'USD' });
  const Residence = require('../model/schema/residence');
  assert.equal(new Residence({ ...validated, createBy: id }).validateSync(), undefined);
  assert.doesNotThrow(() => validateFields({ fields }, { name: 'Legacy Residence' }));
  for (const [field, value] of [['blockCount', -1], ['floorCount', 1.5], ['unitCount', 0], ['constructionYear', 2300], ['amenities', ['UNKNOWN']], ['totalArea', -10], ['email', 'invalid'], ['mapUrl', 'javascript:alert(1)']]) {
    assert.throws(() => validateFields({ fields }, { ...values, [field]: value }), { code: 'invalid', field });
  }
  const baseline = { fields };
  const saved = validateDefinition({ fields: fields.map(field => field.name === 'unitCount' ? { ...field, integer: false } : field) }, baseline, baseline);
  assert.equal(saved.find(field => field.name === 'unitCount').integer, false);
});

test('residences require the selected customer for a completed transaction and clear stale buyers', () => {
  const { normalizeSale } = require('../services/estateValidation');
  const fields = defaults.Residences;
  for (const [transactionType, status] of [['SALE', 'SOLD'], ['RENT', 'RENTED']]) {
    assert.throws(() => validateFields({ fields }, { name: 'Residence', transactionType, sale: { status } }), { field: 'sale.buyerType', code: 'required' });
    for (const buyerType of ['LEAD', 'PARTNER_CUSTOMER']) {
      const input = { name: 'Residence', transactionType, sale: { status, buyerType, lead: id, partnerCustomer: id } };
      const result = normalizeSale(validateFields({ fields }, input).sale, transactionType);
      assert.equal(result.status, status);
      assert.equal(result[buyerType === 'LEAD' ? 'lead' : 'partnerCustomer'], id);
      assert.equal(result[buyerType === 'LEAD' ? 'partnerCustomer' : 'lead'], null);
      assert.ok(result.soldAt);
    }
  }
  assert.throws(() => normalizeSale({ status: 'RENTED', buyerType: 'LEAD', lead: id }, 'SALE'), { field: 'sale.status' });
  const released = normalizeSale({ status: 'AVAILABLE', buyerType: 'LEAD', lead: id, soldAt: '2026-01-01' }, 'RENT');
  assert.equal(released.lead, null); assert.equal(released.soldAt, null);
});

test('loaded lead relations validate and survive an edit payload', () => {
  const body = { leadName: 'Lead', leadEmail: 'lead@example.com', contact: id, partnerCustomer: id, relatedOpportunities: [id] };
  const result = validateFields({ fields: defaults.Leads }, body);
  assert.equal(result.contact, id);
  assert.equal(result.partnerCustomer, id);
  assert.deepEqual(result.relatedOpportunities, [id]);
  assert.throws(() => validateFields({ fields: defaults.Leads }, { ...body, relatedOpportunities: ['invalid-id'] }));
  const cleared = validateFields({ fields: defaults.Leads }, { ...body, contact: null, partnerCustomer: null, relatedOpportunities: [] });
  assert.equal(cleared.contact, null);
  assert.equal(cleared.partnerCustomer, null);
});
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
test('builder adds, edits, reorders and removes fields while validating metadata', () => {
  const baseline = { fields: defaults.Properties }; const current = { ...baseline };
  const added = validateDefinition({ fields: [...baseline.fields, custom] }, current, baseline);
  assert.equal(added.at(-1).label.fa, 'آزمون');
  const edited = validateDefinition({ fields: [{ ...custom, label: { ...custom.label, en: 'Changed' } }, ...baseline.fields] }, { fields: added }, baseline);
  assert.equal(edited[0].order, 0); assert.equal(edited[0].label.en, 'Changed');
  assert.equal(validateDefinition(baseline, { fields: edited }, baseline).length, baseline.fields.length);
  assert.deepEqual(validateDefinition({ fields: [] }, current, baseline), []);
  assert.throws(() => validateDefinition({ fields: [...baseline.fields, { ...custom, label: { en: 'Only' } }] }, current, baseline));
});
test('form builder catalogs every CRM data-entry module with unique valid fields', () => {
  const expectedModules = [
    'Properties', 'Partner Customers', 'Residences', 'Leads', 'Contacts',
    'Opportunities', 'Tasks', 'Meetings', 'Calls', 'Emails', 'Invoices',
    'Quotes', 'Opportunity Project', 'Bank Details', 'Documents', 'Users',
    'Email Template',
  ];
  assert.deepEqual(Object.keys(defaults), expectedModules);
  for (const [moduleName, fields] of Object.entries(defaults)) {
    assert(fields.length > 0, `${moduleName} has no fields`);
    assert.equal(new Set(fields.map(field => field.name)).size, fields.length, `${moduleName} has duplicate fields`);
    assert.equal(validateDefinition({ fields }, { fields }, { fields }).length, fields.length);
  }
  assert(defaults.Properties.some(field => field.name === 'lrNo'));
  assert(defaults.Invoices.some(field => field.name === 'quoteStage'));
  assert(defaults.Leads.some(field => field.name === 'associatedListing' && field.external));
});
test('migration preserves explicit values and reports unknown types', () => {
  assert.deepEqual(mapProperty({ category: 'COMMERCIAL', propertyType: 'Apartment', price: { amount: 10 }, listingPrice: 20 }).update, {});
  assert.equal(mapProperty({ propertyType: 'Unknown' }).unknown, 'Unknown');
  assert.equal(mapProperty({ propertyType: 'Apartment for rent' }).update.transactionType, 'RENT');
});
test('fixed admin and user roles govern modules', () => {
  assert.equal(can({ role: 'user', moduleVisibility: { 'Partner Customers': true } }, 'Partner Customers', 'view'), true);
  assert.equal(can({ role: 'user' }, 'Properties', 'create'), true);
  assert.equal(can({ role: 'user' }, 'Users', 'view'), true);
  assert.equal(can({ role: 'admin' }, 'Residences', 'delete'), true);
});

test('rented properties retain tenant details and reject sale/rental status mismatches', () => {
  const rented = { ...base(), transactionType: 'RENT', sale: { status: 'RENTED', buyerType: 'LEAD', lead: id } };
  assert.equal(normalizeProperty(rented).sale.status, 'RENTED');
  assert.equal(validateFields({ fields: defaults.Properties }, rented).sale.lead, id);
  assert.throws(() => validateFields({ fields: defaults.Properties }, { ...rented, sale: { status: 'RENTED' } }), { field: 'sale.buyerType' });
  assert.throws(() => normalizeProperty({ ...rented, transactionType: 'SALE' }));
  assert.equal(normalizeProperty({ ...rented, sale: { ...rented.sale, status: 'SOLD' } }).sale.status, 'RENTED');
});
test('required fields reject whitespace, unchecked boxes and empty lists but accept zero', () => {
  const { validateRequiredFields } = require('../services/estateValidation');
  const fields = [
    { name: 'description', kind: 'SYSTEM_FIELD', type: 'text', required: true },
    { name: 'consent', kind: 'CUSTOM_FIELD', type: 'checkbox', required: true },
  ];
  assert.throws(() => validateRequiredFields({ fields }, { description: '   ' }), { field: 'description', code: 'required' });
  assert.throws(() => validateRequiredFields({ fields }, { description: 'Valid', customFields: { consent: false } }), { field: 'customFields.consent', code: 'required' });
  assert.doesNotThrow(() => validateRequiredFields({ fields }, { description: 'Valid', customFields: { consent: true } }));
  assert.doesNotThrow(() => validateRequiredFields({ fields: [{ name: 'amount', type: 'number', required: true }] }, { amount: 0 }));
  assert.doesNotThrow(() => validateRequiredFields({ fields: [{ ...fields[0], enabled: false }] }, {}));
});
