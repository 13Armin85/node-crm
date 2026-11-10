// Read-only verification of source-name navigation using existing converted leads.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const mongoose = require('../server/node_modules/mongoose');
const puppeteer = require('../server/node_modules/puppeteer');
require('../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../server/.env'), quiet: true });

async function main() {
  let browser;
  const origin = process.env.CRM_UI_ORIGIN || 'https://37.148.206.74';
  const artifacts = path.resolve(__dirname, '../layout-artifacts/published-lead-source');
  try {
    await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017', {
      dbName: process.env.DB || 'Prolink', autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000,
    });
    const actor = await mongoose.connection.collection('User').findOne({ role: { $in: ['developer', 'admin'] }, deleted: false },
      { projection: { _id: 1, role: 1, authVersion: 1 } });
    assert(actor, 'An active administrator is required');
    const fixtures = [];
    for (const [module, route] of [['Contacts', '/contactView/'], ['Opportunities', '/opportunitiesView/']]) {
      const records = await mongoose.connection.collection(module).find({ deleted: false, 'convertedLeads.values.leadName': { $exists: true } },
        { projection: { _id: 1, 'convertedLeads.leadId': 1, 'convertedLeads.values.leadName': 1 } }).limit(25).toArray();
      for (const record of records) {
        let found = false;
        for (const source of record.convertedLeads || []) {
          if (!/^[a-f\d]{24}$/i.test(source.leadId) || !source.values?.leadName) continue;
          const lead = await mongoose.connection.collection('Leads').findOne({ _id: new mongoose.Types.ObjectId(source.leadId), deleted: true,
            'conversion.completedAt': { $type: 'date' } }, { projection: { _id: 1 } });
          if (!lead) continue;
          fixtures.push({ module, route: route + record._id, source }); found = true; break;
        }
        if (found) break;
      }
    }
    assert(fixtures.length, 'No existing converted lead is available for read-only navigation verification');
    if (process.argv.includes('--discover-only')) {
      console.log(JSON.stringify({ existingSourcesAvailable: true, modules: fixtures.map(item => item.module) })); return;
    }
    await fs.mkdir(artifacts, { recursive: true });
    const token = require('../server/node_modules/jsonwebtoken').sign({ userId: actor._id, sv: actor.authVersion || 0 },
      require('../server/config/auth').jwtSecret, { expiresIn: '5m' });
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true, pipe: true, args: ['--no-sandbox', '--disable-gpu'], userDataDir: path.join(artifacts, 'profile') });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/auth', { waitUntil: 'networkidle2' });
    await page.evaluate((actor, token) => {
      localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(actor)); localStorage.setItem('crm-language', 'fa');
    }, { _id: String(actor._id), role: actor.role, firstName: 'Release check' }, token);
    const checked = [];
    for (const fixture of fixtures) {
      await page.goto(origin + fixture.route, { waitUntil: 'networkidle2' });
      const selector = `.crm-converted-details a[href="/leadView/${fixture.source.leadId}"]`;
      await page.waitForSelector(selector, { timeout: 30000 });
      assert.equal(await page.$eval(selector, node => node.textContent), fixture.source.values.leadName);
      const response = page.waitForResponse(response => response.url().endsWith('/api/record-workspace/Leads/' + fixture.source.leadId));
      await page.click(selector);
      const result = await response;
      assert.equal(result.status(), 200, 'Original lead destination failed');
      const workspace = await result.json();
      assert.equal(workspace.archived, true); assert.equal(workspace.editable, false);
      await page.waitForSelector('[data-record-module="Leads"] [data-record-field="leadName"] dd');
      assert.equal(new URL(page.url()).pathname, '/leadView/' + fixture.source.leadId);
      assert.equal(await page.$eval('[data-record-field="leadName"] dd', node => node.textContent), fixture.source.values.leadName);
      assert.equal(await page.$$('.crm-record-workspace .crm-record-field--editable, .crm-record-workspace .crm-notes-panel, .crm-record-workspace .crm-detail-legacy').then(nodes => nodes.length), 0);
      checked.push({ sourceModule: fixture.module, navigation: true, originalLeadVisible: true, readOnly: true });
      console.log('PASS: published original-lead name navigation from', fixture.module);
    }
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(artifacts, 'verification.json'), JSON.stringify({ origin, checkedAt: new Date().toISOString(), checked }, null, 2));
  } finally {
    if (browser) await browser.close();
    await mongoose.disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
