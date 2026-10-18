const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const router = require('../controllers/estate/_routes');
const layer = router.stack.find(layer => layer.route?.path === '/:module/options');
const invoke = req => new Promise((resolve, reject) => {
  const res = { status(code) { this.statusCode = code; return this; }, json(data) { resolve({ status: this.statusCode || 200, data }); } };
  let index = 0;
  const next = error => { if (error) reject(error); else layer.route.stack[index++].handle(req, res, next); };
  next();
});
test('all existing relation modules have searchable options without exposing unrelated CRUD', async t => {
  for (const [moduleName, modelName, record] of [
    ['Users', 'User', { firstName: 'Ali', lastName: 'Yılmaz' }],
    ['Contacts', 'Contacts', { fullName: 'Contact' }],
    ['Quotes', 'Quotes', { title: 'Quote' }],
    ['Opportunities', 'Opportunities', { name: 'Opportunity' }],
    ['Documents', 'Document', { folderName: 'Folder' }],
  ]) {
    let filter;
    const lookup = t.mock.method(mongoose.model(modelName), 'find', query => {
      filter = query;
      return { select(fields) {
        assert(!fields.includes('password'));
        return { sort() { return { limit(value) { assert.equal(value, 25); return { lean: async () => [{ _id: '64d33173fd7ff3fa0924a101', ...record }] }; } }; } };
      } };
    });
    const result = await invoke({ method: 'GET', baseUrl: '/api/estate', path: '/' + moduleName + '/options',
      params: { module: moduleName }, query: { q: 'ali yilmaz' }, actor: { _id: '64d33173fd7ff3fa0924a102', role: 'admin' } });
    assert.equal(result.status, 200); assert.equal(result.data.length, 1);
    assert(filter.$and || filter.$or);
    lookup.mock.restore();
  }
  const response = await invoke({ method: 'GET', baseUrl: '/api/estate', path: '/Unknown/options',
    params: { module: 'Unknown' }, query: {}, actor: { role: 'admin' } });
  assert.equal(response.status, 404);
});
test('hidden contacts remain restricted to ownership and explicit shares during options search', async t => {
  let filter;
  t.mock.method(mongoose.model('Contacts'), 'find', query => {
    filter = query;
    return { select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) };
  });
  const actor = { _id: new mongoose.Types.ObjectId('64d33173fd7ff3fa0924a102'), role: 'user', moduleVisibility: { Contacts: false } };
  await invoke({ method: 'GET', baseUrl: '/api/estate', path: '/Contacts/options', params: { module: 'Contacts' },
    query: { q: 'ali' }, actor, recordShares: [] });
  assert(JSON.stringify(filter).includes('createBy'));
  assert(JSON.stringify(filter).includes(String(actor._id)));
});
