// Compare embedded document cards with the sidebar using existing records only.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const mongoose = require('../server/node_modules/mongoose');
const puppeteer = require('../server/node_modules/puppeteer');
require('../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../server/.env'), quiet: true });
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function main() {
  let browser;
  const origin = process.env.CRM_UI_ORIGIN || 'https://37.148.206.74';
  const artifacts = path.resolve(__dirname, '../layout-artifacts/published-document-cards');
  try {
    await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017', {
      dbName: process.env.DB || 'Prolink', autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000,
    });
    const actor = await mongoose.connection.collection('User').findOne({ role: { $in: ['developer', 'admin'] }, deleted: false },
      { projection: { _id: 1, role: 1, authVersion: 1 } });
    assert(actor, 'An active administrator is required');
    const token = require('../server/node_modules/jsonwebtoken').sign({ userId: actor._id, sv: actor.authVersion || 0 },
      require('../server/config/auth').jwtSecret, { expiresIn: '10m' });
    const response = await fetch(origin + '/api/document', { headers: { Authorization: token }, signal: AbortSignal.timeout(25000) });
    assert.equal(response.status, 200, 'Document listing failed');
    const folders = await response.json();
    const documents = folders.flatMap(folder => folder.files.map(file => ({ file, folder })));
    const fixtures = [];
    for (const [entityType, module, route] of [['Lead', 'Leads', '/leadView/'], ['Contact', 'Contacts', '/contactView/'], ['Opportunity', 'Opportunities', '/opportunitiesView/']]) {
      for (const document of documents) {
        const relation = document.file.relatedRecords?.find(record => record.entityType === entityType);
        if (!relation || !/^[a-f\d]{24}$/i.test(relation.entityId)) continue;
        if (!await mongoose.connection.collection(module).findOne({ _id: new mongoose.Types.ObjectId(relation.entityId), deleted: false }, { projection: { _id: 1 } })) continue;
        const download = await fetch(origin + '/api/document/download/' + document.file._id, { headers: { Authorization: token }, signal: AbortSignal.timeout(25000) });
        if (!download.ok) continue;
        fixtures.push({ ...document, module, route: route + relation.entityId, downloadHash: digest(Buffer.from(await download.arrayBuffer())) });
        break;
      }
    }
    assert(fixtures.length, 'No existing readable document is available for browser verification');
    if (process.argv.includes('--discover-only')) {
      console.log(JSON.stringify({ existingDocumentsAvailable: true, modules: fixtures.map(item => item.module) })); return;
    }
    await fs.mkdir(artifacts, { recursive: true });
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true, pipe: true, args: ['--no-sandbox', '--disable-gpu'], userDataDir: path.join(artifacts, 'profile') });
    const page = await browser.newPage();
    const cdp = await page.createCDPSession();
    // Authenticated file requests are checked; avoid leaving downloaded customer files on disk.
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'deny' });
    const errors = [];
    const documentRequests = [];
    page.on('response', async response => {
      const url = new URL(response.url());
      if (!/^\/api\/document\/?$/.test(url.pathname)) return;
      const entry = { status: response.status(), entityType: url.searchParams.get('entityType') };
      documentRequests.push(entry);
      try { const data = await response.json(); entry.files = Array.isArray(data) ? data.flatMap(folder => folder.files || []).length : null; } catch {}
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/auth', { waitUntil: 'networkidle2' });
    await page.evaluate((actor, token) => {
      localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(actor)); localStorage.setItem('crm-language', 'fa');
    }, { _id: String(actor._id), role: actor.role, firstName: 'Release check' }, token);
    const checked = [];
    for (const fixture of fixtures) {
      const selector = `.crm-document-card[data-document-id="${fixture.file._id}"]`;
      let sidebarInformation;
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 950 });
        const query = new URLSearchParams({ file: fixture.file._id });
        if (!fixture.folder.isRoot) query.set('folder', fixture.folder._id);
        await page.goto(origin + '/documents?' + query, { waitUntil: 'networkidle2' });
        await page.waitForSelector(selector, { timeout: 30000 });
        await page.waitForNetworkIdle({ idleTime: 500 });
        sidebarInformation = await page.$eval(selector + ' .crm-document-information', node => node.textContent);
        assert(sidebarInformation.length > 0);
        await page.goto(origin + fixture.route, { waitUntil: 'networkidle2' });
        if (fixture.module === 'Opportunities') {
          await page.waitForSelector('.crm-record-activities [role="tab"]');
          const tabs = await page.$$('.crm-record-activities [role="tab"]'); await tabs[tabs.length - 1].click();
        }
        try { await page.waitForSelector('.crm-record-documents ' + selector, { timeout: 30000 }); }
        catch {
          console.error(JSON.stringify({ module: fixture.module, browserErrors: errors, documentRequests,
            dom: await page.evaluate(() => ({ workspace: document.querySelector('.crm-record-workspace')?.getAttribute('data-record-module'),
              documentPanels: document.querySelectorAll('.crm-record-documents').length, cards: document.querySelectorAll('.crm-document-card').length,
              alerts: document.querySelectorAll('[role="alert"]').length })) }));
          throw new Error('Embedded document card was not found');
        }
        await page.waitForNetworkIdle({ idleTime: 500 });
        const embedded = await page.$eval('.crm-record-documents ' + selector, node => ({
          information: node.querySelector('.crm-document-information').textContent,
          download: Boolean(node.querySelector('button[aria-label]')),
          overflow: node.scrollWidth > node.clientWidth + 2,
        }));
        assert.equal(embedded.information, sidebarInformation, 'Embedded document information differs from sidebar');
        assert(embedded.download); assert(!embedded.overflow, 'Document card overflows its container');
        if (width === 1440) {
          const download = page.waitForResponse(response => response.url().endsWith('/api/document/download/' + fixture.file._id));
          await page.click('.crm-record-documents ' + selector + ' button');
          const downloaded = await download;
          assert.equal(downloaded.status(), 200, 'Download button failed');
          assert.match(downloaded.headers()['content-disposition'] || '', /attachment/);
          assert.equal(digest(await downloaded.buffer()), fixture.downloadHash, 'Downloaded file content differs');
        }
        checked.push({ module: fixture.module, width, matchesSidebar: true, download: true });
        console.log('PASS: published document card matches sidebar', fixture.module, width);
      }
    }
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(artifacts, 'verification.json'), JSON.stringify({ origin, checkedAt: new Date().toISOString(), checked }, null, 2));
  } finally {
    if (browser) await browser.close();
    await mongoose.disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
