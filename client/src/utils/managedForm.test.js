import { normalizeFormValues, validateFormValues } from './managedForm';

const contact = '64d33173fd7ff3fa0924a109';
const partner = '64d33173fd7ff3fa0924a110';
test('stored room aliases select the configured option and residence multiselects keep old scalar values', () => {
  const definition = { fields: [
    { name: 'bedroom', kind: 'SYSTEM_FIELD', type: 'select', options: [{ value: '1+2' }] },
    { name: 'unitTypes', kind: 'SYSTEM_FIELD', type: 'multiselect', options: [{ value: '1+3' }] },
    { name: 'constructionStatus', type: 'multiselect', options: [{ value: 'READY' }] },
  ] };
  const values = { bedroom: '۲ + ۱', unitTypes: ['3+1'], constructionStatus: 'READY' };
  expect(normalizeFormValues(definition, values)).toEqual({ bedroom: '1+2', unitTypes: ['1+3'], constructionStatus: ['READY'] });
  expect(validateFormValues(definition, values)).toEqual({});
  expect(validateFormValues(definition, { bedroom: '5+5' })).toEqual({ bedroom: 'invalid' });
});
const definition = { fields: [
  { name: 'leadName', type: 'text', required: true },
  { name: 'legacyRequired', type: 'text', required: true, enabled: false },
  { name: 'contact', type: 'select', relation: 'Contacts', external: true },
  { name: 'partnerCustomer', type: 'select', relation: 'Partner Customers', external: true },
  { name: 'relatedOpportunities', type: 'text', relation: 'Opportunities', external: true },
  { name: 'leadMobile', type: 'phone' },
  { name: 'reference', type: 'text', kind: 'CUSTOM_FIELD', required: true },
] };

test('editing a loaded lead preserves its populated relations as IDs', () => {
  const values = { leadName: 'Lead', contact: { _id: contact, fullName: 'Contact' }, partnerCustomer: { _id: partner }, relatedOpportunities: [{ _id: contact }], customFields: { reference: 'REF' } };
  expect(validateFormValues(definition, values)).toEqual({});
  expect(normalizeFormValues(definition, values)).toMatchObject({ contact, partnerCustomer: partner, relatedOpportunities: [contact] });
  expect(values.contact.fullName).toBe('Contact');
});

test('the visible definition controls validation, including custom fields', () => {
  const values = { leadName: 'Lead', leadMobile: '', contact: null, partnerCustomer: '', relatedOpportunities: [] };
  expect(validateFormValues(definition, values)).toEqual({ customFields: { reference: 'required' } });
  expect(normalizeFormValues(definition, values).partnerCustomer).toBeNull();
});

test('numeric legacy phone values and amount strings can be saved', () => {
  const definition = { fields: [{ name: 'phoneNumber', type: 'phone' }, { name: 'price.amount', type: 'currency', min: 0 }] };
  const values = { phoneNumber: 905551112233, price: { amount: '1500000' } };
  expect(validateFormValues(definition, values)).toEqual({});
  expect(normalizeFormValues(definition, values)).toEqual({ phoneNumber: '905551112233', price: { amount: 1500000 } });
  expect(validateFormValues(definition, { price: { amount: -1 } })).toEqual({ price: { amount: 'invalid' } });
});

test('required booleans and whitespace fail while zero and hidden conditional fields remain valid', () => {
  const definition = { fields: [
    { name: 'consent', kind: 'CUSTOM_FIELD', type: 'checkbox', required: true },
    { name: 'amount', type: 'number', required: true },
    { name: 'notes', type: 'text', required: true, condition: { status: ['SOLD', 'RENTED'] } },
  ] };
  expect(validateFormValues(definition, { amount: 0, customFields: { consent: false } })).toEqual({ customFields: { consent: 'required' } });
  expect(validateFormValues(definition, { amount: 0, status: 'RENTED', notes: ' ', customFields: { consent: true } })).toEqual({ notes: 'required' });
});


test('lead forms clear conflicting populated relations and ignore requirements for hidden alternatives', () => {
  const leadDefinition = { moduleName: 'Leads', fields: [
    { name: 'lead', type: 'select', relation: 'Leads', external: true, required: true },
    { name: 'contact', type: 'select', relation: 'Contacts', external: true, required: true },
    { name: 'partnerCustomer', type: 'select', relation: 'Partner Customers', external: true, required: true },
  ] };
  const lead = '64d33173fd7ff3fa0924a111';
  const values = { lead: { _id: lead }, contact: { _id: contact }, partnerCustomer: { _id: partner } };
  expect(normalizeFormValues(leadDefinition, values)).toEqual({ lead, contact: null, partnerCustomer: null });
  expect(validateFormValues(leadDefinition, values)).toEqual({});
  expect(normalizeFormValues(leadDefinition, { lead: null, contact, partnerCustomer: partner })).toEqual({ lead: null, contact, partnerCustomer: null });
  expect(validateFormValues(leadDefinition, { lead: null, contact, partnerCustomer: null })).toEqual({});
});


test.each([
  {},
  { lead: null, contact: null, partnerCustomer: null },
  { lead: '', contact: '', partnerCustomer: '' },
])('lead selection is optional even when no existing customer is selected: %p', values => {
  const definition = { moduleName: 'Leads', fields: [] };
  expect(validateFormValues(definition, values)).toEqual({});
});


test.each(['lead', 'contact', 'partnerCustomer'])('a single %s is sufficient without choosing the other relations', name => {
  const definition = { moduleName: 'Leads', fields: [] };
  expect(validateFormValues(definition, { [name]: '64d33173fd7ff3fa0924a109' })).toEqual({});
});


test('lead core and custom fields remain optional even under old saved requirements', () => {
  const stale = { moduleName: 'Leads', fields: [
    { name: 'leadName', type: 'text', required: true },
    { name: 'leadEmail', type: 'email', required: true },
    { name: 'score', kind: 'CUSTOM_FIELD', type: 'number', required: true },
  ] };
  expect(validateFormValues(stale, {})).toEqual({});
  expect(validateFormValues(stale, { leadEmail: 'invalid' })).toEqual({ leadEmail: 'invalid' });
});
