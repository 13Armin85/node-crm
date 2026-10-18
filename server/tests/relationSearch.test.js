const { test } = require('node:test');
const assert = require('node:assert/strict');
const { searchCondition, optionLabel } = require('../services/relationSearch');
const matches = (query, item) => (searchCondition(Object.keys(item), query).$and || []).every(term =>
  term.$or.some(condition => Object.entries(condition).some(([field, value]) => new RegExp(value.$regex, value.$options).test(String(item[field])))));
test('relation search handles Turkish letters, Persian keyboard variants, digits and separate name fields', () => {
  assert(matches('istanbul', { title: 'İstanbul' }));
  assert(matches('sisli', { title: 'Şişli' }));
  assert(matches('  ali   yilmaz  ', { firstName: 'Ali', lastName: 'Yılmaz' }));
  assert(matches('كيا', { fullName: 'کیا' }));
  assert(matches('۱۲۳', { phone: '123' }));
  assert(!matches('ali brown', { firstName: 'Ali', lastName: 'Yılmaz' }));
  assert(matches('a+b', { title: 'A+B' })); assert(!matches('a+b', { title: 'AAAB' }));
  assert(matches('[', { title: '[' }));
  assert.deepEqual(searchCondition(['title'], '   '), {});
});
test('relation labels use real names for every existing form relation', () => {
  assert.equal(optionLabel({ _id: '1', firstName: 'Ali', lastName: 'Yılmaz' }), 'Ali Yılmaz');
  assert.equal(optionLabel({ _id: '1', fullName: 'Contact' }), 'Contact');
  assert.equal(optionLabel({ _id: '1', companyName: 'Company' }), 'Company');
  assert.equal(optionLabel({ _id: '1', folderName: 'Files' }), 'Files');
});

test('numeric phone searches cast as Mongo expressions instead of unsupported number regex filters', () => {
  const User = require('../model/schema/user');
  const condition = searchCondition(['firstName', 'phoneNumber'], '123', ['phoneNumber']);
  const numeric = condition.$and[0].$or[1].$expr.$regexMatch;
  assert.equal(numeric.input.$convert.input, '$phoneNumber');
  assert.equal(numeric.input.$convert.to, 'string');
  assert.doesNotThrow(() => User.find(condition).cast(User));
});
