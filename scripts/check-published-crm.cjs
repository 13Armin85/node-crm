// Read-only deployment verification. Never print credentials, tokens or CRM records.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('../server/node_modules/mongoose');
require('../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../server/.env'), quiet: true });
const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const backendOnly = args.includes('--backend-only');
const origin = option('--origin') || (backendOnly ? 'http://127.0.0.1:5001' : 'https://37.148.206.74');
const keys = ['soldProperties', 'successfulIncome', 'lostIncome'];
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function main() {
  let verificationSessionId;
  try {
    await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017', {
      dbName: process.env.DB || 'Prolink', autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000,
    });
    const actor = await mongoose.connection.collection('User').findOne({ role: { $in: ['developer', 'admin'] }, deleted: false }, { projection: { _id: 1, authVersion: 1 } });
    assert(actor, 'An active administrator is required for verification');
    verificationSessionId = crypto.randomBytes(32).toString('hex');
    await mongoose.connection.collection('Session').insertOne({
      _id: verificationSessionId,
      userId: actor._id,
      rememberMe: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      revokedAt: null,
      userAgent: 'NodeCRM deployment verifier',
    });
    const token = require('../server/node_modules/jsonwebtoken').sign({ userId: actor._id, sv: actor.authVersion || 0, sid: verificationSessionId }, require('../server/config/auth').jwtSecret, { expiresIn: '5m' });
    const get = async route => {
      const response = await fetch(origin + '/api' + route, { headers: { Authorization: token }, signal: AbortSignal.timeout(25000) });
      assert.equal(response.status, 200, 'Published API unavailable: ' + route.replace(/[a-f\d]{24}/gi, ':id'));
      assert.match(response.headers.get('cache-control') || '', /private, no-store/);
      return response.json();
    };
    let finance;
    for (let attempt = 0; attempt < 15; attempt++) {
      try { finance = await get('/estate/dashboard/finance'); break; }
      catch (error) { if (attempt === 14) throw error; await new Promise(resolve => setTimeout(resolve, 1000)); }
    }
    assert.deepEqual(Object.keys(finance).sort(), [...keys].sort());
    const statusSummary = await get('/status/?summary=1');
    assert(statusSummary.data?.taskCounts && statusSummary.data?.leadCounts, 'Published backend lacks grouped dashboard counts');
    for (const key of keys) {
      assert(Number.isInteger(finance[key].count) && finance[key].count >= 0);
      assert(Array.isArray(finance[key].values));
      for (const value of finance[key].values) assert(Number.isFinite(value.amount) && value.amount >= 0 && ['TRY', 'USD', 'EUR'].includes(value.currency));
    }
    const residenceDefinition = await get('/estate/definitions/Residences');
    assert(residenceDefinition.fields.some(field => field.name === 'paymentMethod'), 'Published backend has an outdated residence form');
    const lead = await mongoose.connection.collection('Leads').findOne({ deleted: false }, { projection: { _id: 1 } });
    if (lead) assert(Array.isArray((await get('/record-workspace/Leads/' + lead._id + '/notes')).items));
    const opportunity = await mongoose.connection.collection('Opportunities').findOne({ deleted: false }, { projection: { _id: 1 } });
    if (opportunity) {
      const activities = await get('/record-workspace/Opportunities/' + opportunity._id + '/activities');
      for (const module of ['Emails', 'Calls', 'Meetings', 'Tasks']) assert(Array.isArray(activities[module]));
    }
    if (!backendOnly) {
      const rate = await get('/estate/dashboard/exchange-rate');
      assert(rate.tryPerUsd > 0 && rate.tryPerEur > 0, 'Published currency conversion unavailable');
      const release = path.resolve(option('--release-dir') || path.join(__dirname, '../client/build'));
      for (const filename of ['index.html', 'asset-manifest.json', 'service-worker.js']) {
        const response = await fetch(origin + '/' + filename + '?crm-release-check=' + Date.now(), { signal: AbortSignal.timeout(15000) });
        assert.equal(response.status, 200, filename);
        assert.equal(digest(Buffer.from(await response.arrayBuffer())), digest(await fs.readFile(path.join(release, filename))), 'Published file differs from the release: ' + filename);
      }
      const manifest = JSON.parse(await fs.readFile(path.join(release, 'asset-manifest.json'), 'utf8'));
      for (const asset of Object.values(manifest.files).filter(asset => !asset.endsWith('.map'))) {
        const response = await fetch(origin + asset, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
        assert.equal(response.status, 200, 'Published asset missing: ' + asset);
      }
    }
    console.log(JSON.stringify({ verified: true, origin, backend: true, financialCards: keys.length, residencePaymentField: true, leadNotes: Boolean(lead), opportunityActivities: Boolean(opportunity), clientAssets: !backendOnly, currencyConversion: !backendOnly }));
  } finally {
    if (verificationSessionId) await mongoose.connection.collection('Session').deleteOne({ _id: verificationSessionId }).catch(() => {});
    await mongoose.disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
