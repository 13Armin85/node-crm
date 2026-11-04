const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { performance } = require('node:perf_hooks');

test('backend optimizations preserve financial totals, report permissions and folder inheritance', {
  skip: process.env.BACKEND_INTEGRATION !== '1', timeout: 120000,
}, async t => {
  const dbName = 'crm_backend_test_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000, monitorCommands: true });
  let server;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    assert.equal(mongoose.connection.name, dbName);
    assert(dbName.startsWith('crm_backend_test_'));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  t.mock.method(require('../middelwares/mail'), 'sendEmail', async () => null);
  const { app } = require('../index');
  const User = require('../model/schema/user');
  const Opportunity = require('../model/schema/opprtunity');
  const Email = require('../model/schema/email');
  const Call = require('../model/schema/phoneCall');
  const Text = require('../model/schema/textMsg');
  const Document = require('../model/schema/document');
  const Share = require('../model/schema/recordShare');
  const admin = await User.create({ username: 'admin@test.invalid', password: 'unused', role: 'admin', firstName: 'Admin' });
  const user = await User.create({ username: 'user@test.invalid', password: 'unused', role: 'user', firstName: 'Seller' });
  const other = await User.create({ username: 'other@test.invalid', password: 'unused', role: 'user', firstName: 'Other' });
  await Promise.all([Opportunity.init(), Email.init(), Call.init(), Text.init(), Document.init(), Share.init()]);
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const api = async (route, body, actor = admin, headers = {}) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api' + route, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: jwt.sign({ userId: actor._id }, require('../config/auth').jwtSecret, { expiresIn: '5m' }), 'Content-Type': 'application/json', ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, headers: response.headers, data: await response.json() };
  };

  await t.test('daily/weekly UTC chart shapes, empty buckets and all data scopes stay compatible', async () => {
    const fixtures = [
      ['2026-12-31T00:00:00Z', user, false], ['2027-01-01T12:00:00Z', user, false],
      ['2027-01-04T23:59:59Z', other, false], ['2027-01-05T12:00:00Z', user, true],
      ['2026-12-30T23:59:59Z', user, false], ['2027-01-07T00:00:00Z', user, false],
    ];
    for (const Model of [Email, Call, Text]) await Model.collection.insertMany(fixtures.map(([date, actor, deleted]) => ({ sender: actor._id, createBy: actor._id, timestamp: new Date(date), deleted })));
    const body = { startDate: '2026-12-31', endDate: '2027-01-06', filter: 'day' };
    const daily = await api('/reporting/index', body);
    assert.equal(daily.status, 200);
    assert.equal(daily.data.Email[0].totalEmails, 3);
    assert.equal(daily.data.Call[0].totalCall, 3);
    // Texts have no soft-delete field in the existing schema/API.
    assert.equal(daily.data.Text[0].totalTextSent, 4);
    assert.deepEqual(daily.data.Email[0].Emails.map(row => row.Emailcount), [1, 1, 0, 0, 1, 0, 0]);
    const weekly = await api('/reporting/index', { ...body, filter: 'week' });
    assert.deepEqual(weekly.data.Email[0].Emails, [{ date: '2026-12-28', Emailcount: 2 }, { date: '2027-01-04', Emailcount: 1 }]);
    const own = await api('/reporting/index', body, user);
    assert.equal(own.data.Email[0].totalEmails, 2);
    const subject = await api('/reporting/index', body, admin, { 'X-CRM-Data-User': String(other._id) });
    assert.equal(subject.data.Email[0].totalEmails, 1);
    const filtered = await api('/reporting/index?sender=' + user._id, body);
    assert.equal(filtered.data.Email[0].totalEmails, 2);
    assert.equal((await api('/reporting/index', body, user, { 'X-CRM-Data-User': String(other._id) })).status, 403);
    for (const invalid of [{ ...body, startDate: '2026-02-30' }, { ...body, endDate: '9999-12-31' }]) assert.equal((await api('/reporting/index', invalid)).status, 400);
    assert.equal((await api('/reporting/index?sender=invalid', body)).status, 400);
    assert.match(daily.headers.get('cache-control'), /private, no-store/);
    assert.match(daily.headers.get('vary'), /Authorization/);
    assert.match(daily.headers.get('vary'), /X-CRM-Data-User/);
    assert.equal((await api('/user/options', null, admin, { Origin: 'https://foreign.invalid' })).headers.get('access-control-allow-origin'), null);
  });

  await t.test('shared folders read only their descendants and preserve missing legacy root flags, revocation and cycles', async () => {
    const unrelated = await Document.create({ folderName: 'Unrelated private tree', createBy: other._id });
    const root = await Document.create({ folderName: 'Granted tree', createBy: admin._id, file: [{ fileName: 'root.txt', path: 'test-only-root.txt', deleted: false }] });
    const child = await Document.create({ folderName: 'Child', createBy: admin._id, parentFolder: root._id, file: [{ fileName: 'child.txt', path: 'test-only-child.txt', deleted: false }, { fileName: 'removed.txt', path: 'test-only-deleted.txt', deleted: true }] });
    const grandchild = await Document.create({ folderName: 'Grandchild', createBy: admin._id, parentFolder: child._id });
    const removed = await Document.create({ folderName: 'Deleted tree', createBy: admin._id, parentFolder: root._id, deleted: true });
    const legacy = new mongoose.Types.ObjectId();
    await Document.collection.insertOne({ _id: legacy, folderName: 'Legacy child', parentFolder: child._id, createBy: admin._id, deleted: false, file: [] });
    await Document.updateOne({ _id: root._id }, { $set: { parentFolder: grandchild._id } });
    await Share.create({ module: 'Documents', recordId: root._id, recipient: user._id, sharedBy: admin._id });
    const originalFind = Document.find;
    const queries = [];
    const spy = t.mock.method(Document, 'find', function (query, ...args) { queries.push(query); return originalFind.call(this, query, ...args); });
    const { loadShares } = require('../services/recordSharing');
    const shares = await loadShares(user);
    const ids = new Set(shares.map(share => String(share.recordId)));
    for (const id of [root._id, root.file[0]._id, child._id, child.file[0]._id, grandchild._id, legacy]) assert(ids.has(String(id)));
    for (const id of [unrelated._id, removed._id, child.file[1]._id]) assert(!ids.has(String(id)));
    assert(queries.length > 1 && queries.length < 8);
    assert(queries.every(query => query._id?.$in || query.parentFolder?.$in), 'Never scan unrelated folder trees');
    spy.mock.restore();
    await Share.deleteMany({ recipient: user._id });
    assert.deepEqual(await loadShares(user), []);
  });

  await t.test('large financial reports match the previous calculation with bounded transfer and indexed dates', async () => {
    const { commissionSummary, since } = require('../services/commissionSummary');
    const { outcome } = require('../services/opportunityMetrics');
    const { readScope } = require('../services/recordAccess');
    const now = new Date('2026-11-04T12:00:00Z');
    const stages = ['Closed/Won', 'Closed/Lost', 'Qualification', 'SOLD', 'custom-win', 'LOSS', 'won again'];
    const currencies = ['TRY', 'USD', '$', 'EUR', null, ''];
    const docs = Array.from({ length: 12000 }, (_, index) => ({
      createBy: index % 2 ? user._id : admin._id, ...(index % 3 ? { assignUser: other._id } : {}),
      deleted: index % 37 === 0,
      salesStage: stages[index % stages.length], currency: currencies[index % currencies.length],
      commission: index % 11 === 0 ? null : index % 13 === 0 ? -5 : (index % 1000) / 10,
      amount: index % 4 === 0 ? null : String(index + 500), opportunityAmount: String(index + 1000),
      createdDate: new Date(now - (index % 500) * 86400000),
      ...(index % 3 ? { closedAt: new Date(now - (index % 450) * 86400000) } : {}),
    }));
    await Opportunity.collection.insertMany(docs);
    const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
    const reference = async req => {
      const period = req.query.period || 'year', currency = req.query.currency || 'TRY', teamMonths = Number(req.query.teamMonths || 3);
      const start = since(now, period), teamStart = since(now, {3:'quarter',6:'half',12:'year'}[teamMonths]);
      const earliest = start < teamStart ? start : teamStart;
      const currencyMatch = currency === 'TRY' ? { $or: [{ currency: 'TRY' }, { currency: null }, { currency: '' }] } : { currency: { $in: currency === 'USD' ? ['USD', '$'] : [currency] } };
      const effective = { $ifNull: ['$closedAt', '$createdDate'] };
      const records = await Opportunity.find(readScope(req, req.actor, 'Opportunities', { deleted: false, ...currencyMatch, $expr: { $and: [{ $gte: [effective, earliest] }, { $lte: [effective, now] }] } })).select('salesStage commission amount opportunityAmount closedAt createdDate assignUser createBy').lean();
      const buckets = Object.fromEntries(['sold','available','lost','total'].map(key => [key, { count: 0, amount: 0 }]));
      const sellers = new Map();
      for (const record of records) {
        const date = new Date(record.closedAt || record.createdDate), commission = Math.max(0, Number(record.commission) || 0);
        const state = outcome(record.salesStage), key = state === 'won' ? 'sold' : state === 'lost' ? 'lost' : 'available';
        if (date >= start) for (const bucket of [key, 'total']) { buckets[bucket].count++; buckets[bucket].amount += commission; }
        if (state === 'won' && date >= teamStart) {
          const id = String(record.assignUser || record.createBy);
          const seller = sellers.get(id) || { userId: id, soldCount: 0, commission: 0, salesAmount: 0 };
          seller.soldCount++; seller.commission += commission; seller.salesAmount += Math.max(0, Number(record.amount ?? record.opportunityAmount) || 0);
          sellers.set(id, seller);
        }
      }
      return { buckets, sellers, records };
    };
    const requests = [];
    for (const currency of ['TRY', 'USD', 'EUR']) for (const period of ['week', 'month', 'half', 'year']) requests.push({ actor: admin, query: { currency, period, teamMonths: '12' } });
    requests.push({ actor: user, query: {} }, { actor: admin, dataSubject: user._id, query: { teamMonths: 6 } });
    for (const req of requests) {
      const expected = await reference(req), actual = await commissionSummary(req, now);
      for (const [key, value] of Object.entries(expected.buckets)) {
        assert.equal(actual[key].count, value.count, key);
        assert.equal(actual[key].values[0].amount, round(value.amount), key);
      }
      assert.equal(actual.bySeller.length, expected.sellers.size);
      for (const seller of actual.bySeller) {
        const expectedSeller = expected.sellers.get(seller.userId);
        assert.equal(seller.soldCount, expectedSeller.soldCount);
        assert.equal(seller.commission, round(expectedSeller.commission));
        assert.equal(seller.salesAmount, round(expectedSeller.salesAmount));
      }
    }
    const req = { actor: admin, query: { period: 'year', teamMonths: 12, currency: 'TRY' } };
    const first = performance.now(); const previous = await reference(req); const previousMS = performance.now() - first;
    const second = performance.now(); const current = await commissionSummary(req, now); const currentMS = performance.now() - second;
    const beforeBytes = Buffer.byteLength(JSON.stringify(previous.records)), afterBytes = Buffer.byteLength(JSON.stringify(current));
    assert(afterBytes < beforeBytes / 20);
    const explanation = await Opportunity.find({ deleted: false, closedAt: { $gte: since(now, 'week'), $lte: now } }).explain('executionStats');
    assert(JSON.stringify(explanation.queryPlanner.winningPlan).includes('IXSCAN'));
    t.diagnostic(JSON.stringify({ fixtureRecords: docs.length, financialRecordsBefore: previous.records.length, responseBytesBefore: beforeBytes, responseBytesAfter: afterBytes, transferReductionPercent: +(100 * (1 - afterBytes / beforeBytes)).toFixed(2), referenceMS: +previousMS.toFixed(2), optimizedMS: +currentMS.toFixed(2) }));
  });
});
