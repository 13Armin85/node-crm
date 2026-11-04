const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { jwtSecret } = require('../config/auth');
const { createServer, gracefulShutdown } = require('../services/serverLifecycle');
const { dateRange, buildBuckets } = require('../services/reportTimeline');

test('report windows reject invalid calendar dates and bound output size before database access', () => {
  for (const body of [{}, { startDate: '2026-02-30', endDate: '2026-03-01' }, { startDate: '0000-01-01', endDate: '9999-12-31' }, { startDate: ['2026-01-01'], endDate: '2026-01-02' }, { startDate: '2026-01-02', endDate: '2026-01-01' }]) assert.equal(dateRange(body), null);
  const range = dateRange({ startDate: '2024-02-29', endDate: '2024-03-01' });
  assert(range);
  assert.equal(buildBuckets(range.start, range.end, false).length, 2);
  assert.deepEqual(buildBuckets(new Date('2026-12-31'), new Date('2027-01-06'), true), ['2026-12-28', '2027-01-04']);
});

test('an unavailable database is forwarded as an operational error and does not invalidate the JWT', async t => {
  const User = require('../model/schema/user');
  const failure = Object.assign(new Error('private connection details'), { name: 'MongoServerSelectionError' });
  t.mock.method(User, 'findOne', () => ({ select: async () => { throw failure; } }));
  const req = { headers: { authorization: jwt.sign({ userId: new mongoose.Types.ObjectId() }, jwtSecret, { expiresIn: '5m' }) } };
  const res = { status() { assert.fail('Must forward database failure'); } };
  let forwarded;
  await require('../middelwares/auth')(req, res, error => { forwarded = error; });
  assert.equal(forwarded, failure);
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  require('../middelwares/securityHeaders').errorHandler(forwarded, req, response, () => {});
  assert.equal(response.code, 503);
  assert(!JSON.stringify(response.body).includes('private connection'));
});

test('server applies header limits and shutdown drains active requests before closing the database', async t => {
  let finish;
  const active = new Promise(resolve => { finish = resolve; });
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const server = createServer(async (req, res) => { entered(); await active; res.end('saved'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  assert.equal(server.headersTimeout, 30000);
  assert.equal(server.maxHeaderSize, 16384);
  let disconnected = 0;
  const stop = gracefulShutdown(server, async () => { disconnected++; }, 1000);
  const response = fetch('http://127.0.0.1:' + server.address().port);
  await started;
  const stopping = stop();
  assert.equal(stop(), stopping);
  assert.equal(disconnected, 0);
  finish();
  assert.equal(await (await response).text(), 'saved');
  await stopping;
  assert.equal(disconnected, 1);
  assert.equal(server.listening, false);
});

test('oversized HTTP headers are rejected before reaching application handlers', async t => {
  const server = createServer(() => assert.fail('Oversized header reached app'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const status = await new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port: server.address().port, headers: { 'X-Oversized': 'x'.repeat(20000) } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject);
  });
  assert.equal(status, 431);
});
