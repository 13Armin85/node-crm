const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalize, phone, identityTokens, assertUnique } = require('../services/duplicateRecords');
test('identities normalize Persian/Arabic characters, digits, whitespace and email case', () => {
  assert.equal(normalize('  علي  كريمي  '), normalize('علی کریمی'));
  assert.equal(phone('+۹۰ (۵۵۵) ۱۲۳-۴۵۶۷'), '905551234567');
  const a = identityTokens('Contacts', { email: 'PERSON@Example.com', phoneNumber: '+90 (555) 123-4567' });
  const b = identityTokens('Contacts', { email: ' person@example.com ', mobileNumber: '00905551234567' });
  assert.deepEqual(a, b);
  assert.deepEqual(identityTokens('Contacts', { email: 'person@example.com', deleted: true }), []);
});
test('names identify records without phone or email; different residences and properties remain distinct', () => {
  assert.deepEqual(identityTokens('Contacts', { firstName: 'Ali', lastName: 'Karimi' }), identityTokens('Contacts', { fullName: ' ali   karimi ' }));
  assert.deepEqual(identityTokens('Residences', { name: ' Palm ', city: 'ISTANBUL' }), identityTokens('Residences', { name: 'palm', city: 'Istanbul' }));
  assert.notDeepEqual(identityTokens('Residences', { name: 'Palm', city: 'Istanbul' }), identityTokens('Residences', { name: 'Palm', city: 'Ankara' }));
  assert.notDeepEqual(identityTokens('Properties', { title: 'Unit 1', residence: 'a' }), identityTokens('Properties', { title: 'Unit 1', residence: 'b' }));
});
test('legacy rows without index keys reject duplicates without disclosing existing records', async () => {
  let query;
  const model = { modelName: 'Contacts', find: value => { query = value; return { select: () => ({ lean: async () => [{ email: 'Person@example.com' }] }) }; } };
  await assert.rejects(assertUnique(model, { email: 'person@example.com' }, 'own-id'), error => error.code === 'duplicate' && error.status === 409 && error.field === 'email' && !error.record);
  assert.equal(query._id.$ne, 'own-id');
  assert(JSON.stringify(query).includes("$regexMatch"));
});

const overlaps = (moduleName, left, right) => identityTokens(moduleName, left).some(key => identityTokens(moduleName, right).includes(key));
test('names still prevent duplicate people with different emails or phone numbers', () => {
  for (const [moduleName, name] of [['Contacts', { fullName: 'Ali Karimi' }], ['Leads', { leadName: 'Ali Karimi' }], ['PartnerCustomers', { fullName: 'Ali Karimi' }], ['PartnerCustomers', { customerType: 'COMPANY', companyName: 'Example Ltd' }]]) {
    assert(overlaps(moduleName, { ...name, email: 'first@example.test', leadEmail: 'first@example.test', phoneNumber: '123', phone: '123' }, { ...name, email: 'second@example.test', leadEmail: 'second@example.test', phoneNumber: '456', phone: '456' }));
  }
  assert(overlaps('Leads', { leadMobile: '+90 555 111 2233' }, { leadPhoneNumber: '00905551112233' }));
  assert(overlaps('Leads', { leadMobile: '+90 555 111 2233' }, { leadMobile: '00905551112233' }));
});

test('split incoming contact names search legacy fullName records', async () => {
  let query;
  const model = { modelName: 'Contacts', find: value => { query = value; return { select: () => ({ lean: async () => [{ fullName: 'Ali Karimi', email: 'old@example.test' }] }) }; } };
  await assert.rejects(assertUnique(model, { firstName: 'Ali', lastName: 'Karimi', email: 'new@example.test' }), error => error.code === 'duplicate' && error.field === 'fullName');
  assert(JSON.stringify(query).includes('$fullName'));
});
