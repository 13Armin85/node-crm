const { test } = require('node:test');
const assert = require('node:assert/strict');
const Email = require('../model/schema/email');
const controller = require('../controllers/emailHistory/email');
const actorId = '64d33173fd7ff3fa0924a101', otherId = '64d33173fd7ff3fa0924a102';
const firstId = '64d33173fd7ff3fa0924a111', secondId = '64d33173fd7ff3fa0924a112';
function setup(t, role = 'user') {
  const rows = [{ _id: firstId, createBy: actorId, deliveryStatus: 'SENT', deleted: false },
    { _id: secondId, createBy: otherId, deliveryStatus: 'FAILED', deleted: false }];
  const matches = (row, query) => (!query.createBy || String(row.createBy) === String(query.createBy))
    && row.deleted === query.deleted && (typeof query._id === 'string'
      ? row._id === query._id : query._id.$in.map(String).includes(row._id));
  t.mock.method(Email, 'findOneAndUpdate', async (query, update) => {
    const row = rows.find(item => matches(item, query));
    if (!row) return null;
    Object.assign(row, update.$set); return { ...row };
  });
  t.mock.method(Email, 'updateMany', async (query, update) => {
    const found = rows.filter(row => matches(row, query));
    found.forEach(row => Object.assign(row, update.$set));
    return { modifiedCount: found.length };
  });
  const req = { actor: { _id: actorId, role }, method: 'DELETE', params: { id: firstId }, baseUrl: '/api/email' };
  const res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { rows, req, res };
}

test('deleting an owned email removes it from history while retaining its record and sent status', async t => {
  const s = setup(t);
  await controller.deleteData(s.req, s.res);
  assert.equal(s.res.statusCode, 200);
  assert.equal(s.rows.length, 2);
  assert.equal(s.rows[0].deleted, true);
  assert.equal(s.rows[0].deliveryStatus, 'SENT');
  assert.equal(s.rows[1].deleted, false);
});

test('ordinary users cannot delete another user email', async t => {
  const s = setup(t); s.req.params.id = secondId;
  await controller.deleteData(s.req, s.res);
  assert.equal(s.res.statusCode, 404);
  assert(s.rows.every(row => !row.deleted));
});

test('bulk deletion is restricted to the requesting user records', async t => {
  const s = setup(t); s.req.method = 'POST'; s.req.body = [firstId, secondId];
  await controller.deleteMany(s.req, s.res);
  assert.equal(s.res.statusCode, 200);
  assert.equal(s.res.body.deletedCount, 1);
  assert.equal(s.rows[0].deleted, true);
  assert.equal(s.rows[1].deleted, false);
});

test('administrators can delete selected sent and failed emails', async t => {
  const s = setup(t, 'admin'); s.req.method = 'POST'; s.req.body = [firstId, secondId];
  await controller.deleteMany(s.req, s.res);
  assert.equal(s.res.statusCode, 200);
  assert.equal(s.res.body.deletedCount, 2);
  assert(s.rows.every(row => row.deleted));
});

test('invalid and empty deletion requests never alter records', async t => {
  const s = setup(t);
  s.req.params.id = 'invalid'; await controller.deleteData(s.req, s.res);
  assert.equal(s.res.statusCode, 400);
  for (const body of [[], ['invalid'], 'not-an-array', Array(101).fill(firstId)]) {
    s.req.body = body; await controller.deleteMany(s.req, s.res);
    assert.equal(s.res.statusCode, 400);
  }
  assert(s.rows.every(row => !row.deleted));
});
