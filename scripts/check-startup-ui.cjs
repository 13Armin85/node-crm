// Build the client first. API requests use isolated fixtures; no live records are changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('../server/node_modules/puppeteer');

async function main() {
  const root = path.resolve(process.env.CRM_BUILD_ROOT || path.join(__dirname, '../client/build'));
  let failAsset = () => false;
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/__startup-fixture.html') {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      res.end('<!doctype html><html><body></body></html>');
      return;
    }
    if (/\/static\/js\/main\./.test(pathname) && failAsset()) {
      res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      res.end('Missing old asset');
      return;
    }
    let file = path.resolve(root, '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + path.sep)) file = path.join(root, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      if (pathname.startsWith('/static/') || pathname === '/startup.js') { res.writeHead(404); res.end(); return; }
      file = path.join(root, 'index.html');
    }
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const fixtureOrigin = 'http://127.0.0.1:' + server.address().port;
  const origin = process.env.CRM_UI_ORIGIN || fixtureOrigin;
  let browser;
  try {
    const browserName = process.env.CRM_BROWSER || 'chrome';
    assert(['chrome', 'firefox'].includes(browserName), 'CRM_BROWSER must be chrome or firefox');
    const executablePath = process.env.BROWSER_PATH || process.env.CHROME_PATH || (browserName === 'chrome' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
    browser = await puppeteer.launch({ browser: browserName, executablePath, headless: true, pipe: browserName === 'chrome' });
    console.log('Browser: ' + await browser.version());
    const scenarios = ['corrupt-cache', 'broken-json', 'revoked-session', 'malformed-response', 'storage-denied', 'asset-retry', 'asset-unavailable'];
    const selectedScenarios = process.env.CRM_STARTUP_SCENARIOS ? process.env.CRM_STARTUP_SCENARIOS.split(',') : scenarios;
    assert(selectedScenarios.every(scenario => scenarios.includes(scenario)), 'Unknown startup scenario');
    for (const scenario of selectedScenarios) {
      const page = await browser.newPage();
      const errors = [];
      let failedAssets = 0;
      const documentUrls = [];
      let assetsAvailable = false;
      page.on('pageerror', error => { errors.push(error.message); if (process.env.CRM_DEBUG_STARTUP) console.error(error.stack); });
      await page.setViewport({ width: scenario === 'corrupt-cache' ? 390 : 1440, height: 1000 });
      await page.setRequestInterception(true);
      page.on('request', req => {
        const url = new URL(req.url());
        if (req.isNavigationRequest() && req.frame() === page.mainFrame()) documentUrls.push(req.url());
        if (!url.pathname.startsWith('/api/')) { req.continue().catch(() => {}); return; }
        let data = [];
        let status = 200;
        if (url.pathname.startsWith('/api/estate/definitions/')) data = { moduleName: 'Residences', fields: [] };
        else if (url.pathname.startsWith('/api/estate/Residences')) data = { items: [], total: 0 };
        else if (url.pathname.startsWith('/api/estate/dashboard/sales-summary')) data = { sold: { count: 0, values: [] }, available: { count: 0, values: [] }, bySeller: [] };
        else if (url.pathname.startsWith('/api/notification')) data = { notifications: [], unreadCount: 0, hasMore: false };
        else if (url.pathname.startsWith('/api/visibility')) data = { users: [], modules: [], visibility: {}, accessibleModules: [] };
        else if (url.pathname === '/api/user/login') data = {
          user: { _id: '000000000000000000000001', role: 'admin', firstName: 'UI', lastName: 'Tester' },
          token: Buffer.from('{}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture'
        };
        else if (url.pathname.startsWith('/api/user')) data = { user: [] };
        else if (url.pathname.startsWith('/api/status')) data = { data: { leadData: [], taskData: [] } };
        if (scenario === 'revoked-session' && req.headers().authorization) { status = 401; data = { code: 'unauthorized' }; }
        if (scenario === 'malformed-response' && /^\/api\/(images|route|modules)(\/|$)/.test(url.pathname)) data = { message: 'Invalid cached response' };
        req.respond({ status, contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {});
      });
      const seedSession = scenario => {
        // Firefox can create a transient opaque document during navigation. It cannot store test sessions.
        if (window !== window.top || window.location.origin === 'null') return;
        if (scenario === 'storage-denied') {
          for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, {
            configurable: true, get() { throw new DOMException('Storage access denied', 'SecurityError'); }
          });
          return;
        }
        if (sessionStorage.getItem('startup-test-seeded')) return;
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem('startup-test-seeded', '1');
        localStorage.setItem('crm-language', scenario === 'corrupt-cache' ? 'fa' : 'en');
        localStorage.setItem('user', JSON.stringify({ _id: '000000000000000000000001', role: 'admin', firstName: 'UI', lastName: 'Tester' }));
        localStorage.setItem('token', btoa('{}') + '.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.fixture');
        if (scenario === 'corrupt-cache') {
          const persist = value => JSON.stringify({ ...value, _persist: JSON.stringify({ version: -1, rehydrated: true }) });
          localStorage.setItem('persist:image', persist({ images: JSON.stringify({ message: 'Unauthorized' }) }));
          localStorage.setItem('persist:route', persist({ data: JSON.stringify('outdated routes') }));
          localStorage.setItem('persist:lead', '{broken-json');
          localStorage.setItem('persist:contact', persist({ data: JSON.stringify({ error: 'Expired' }) }));
        }
        if (scenario === 'broken-json') localStorage.setItem('user', '{broken-json');
      };
      if (scenario.startsWith('asset-')) {
        await page.goto(fixtureOrigin + '/__startup-fixture.html');
        await page.evaluate(seedSession, scenario);
        documentUrls.length = 0;
      } else {
        await page.evaluateOnNewDocument(seedSession, scenario);
      }
      failAsset = () => {
        if ((scenario === 'asset-unavailable' && !assetsAvailable) || (scenario === 'asset-retry' && failedAssets === 0)) {
          failedAssets++;
          return true;
        }
        return false;
      };
      // Serve actual HTTP failures from a local copy of the deployed build; no browser protocol response overrides.
      const scenarioOrigin = scenario.startsWith('asset-') ? fixtureOrigin : origin;
      const route = scenario === 'corrupt-cache' || scenario === 'malformed-response' ? '/default' : '/residences';
      // Automatic recovery can replace this first navigation while it is still loading.
      try { await page.goto(scenarioOrigin + route, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
      catch (error) { if (!scenario.startsWith('asset-')) throw error; }
      if (scenario === 'asset-unavailable') {
        await page.waitForSelector('#crm-startup-recovery:not([hidden])', { timeout: 30000 });
        // Firefox can issue more than one request for a deferred script. Count page navigations.
        assert.equal(documentUrls.length, 2, 'Only one automatic page reload is allowed: ' + JSON.stringify(documentUrls));
        assert(failedAssets >= 2, 'The bundle must fail on both page loads');
        assert(new URL(page.url()).searchParams.has('_crm_retry'));
        assert(await page.$eval('#crm-startup-retry', el => el.textContent.trim().length > 0));
        await page.waitForFunction(() => document.readyState === 'complete');
        assert.deepEqual(errors, [], 'Failed-asset fallback raised a runtime error before retry');
        assetsAvailable = true;
        await page.$eval('#crm-startup-retry', button => button.click());
        await page.waitForSelector('.crm-entity-page', { timeout: 30000 });
        assert.equal(documentUrls.length, 3, 'The retry control triggers one deliberate document request: ' + JSON.stringify(documentUrls));
        assert.deepEqual(errors, [], scenario + ' raised a runtime error');
      } else {
        const signedOut = ['broken-json', 'revoked-session', 'storage-denied'].includes(scenario);
        await page.waitForSelector(signedOut ? 'input[name="username"]' : route === '/default' ? '.crm-dashboard-page' : '.crm-entity-page', { timeout: 30000 });
        await page.waitForFunction(() => document.getElementById('crm-startup-recovery').hidden);
        if (scenario === 'corrupt-cache') {
          const state = await page.evaluate(() => ({
            cached: ['persist:image', 'persist:route', 'persist:lead', 'persist:contact'].some(key => localStorage.getItem(key)),
            language: localStorage.getItem('crm-language'), token: localStorage.getItem('token'),
          }));
          assert.equal(state.cached, false);
          assert.equal(state.language, 'fa');
          assert(state.token, 'A healthy remembered login is preserved');
          await page.reload({ waitUntil: 'networkidle0' });
          await page.waitForSelector('.crm-dashboard-page');
        }
        if (scenario === 'revoked-session') assert.equal(await page.evaluate(() => localStorage.getItem('token')), null);
        if (scenario === 'storage-denied') {
          assert(await page.evaluate(() => { localStorage.setItem('fixture', 'ok'); return localStorage.getItem('fixture') === 'ok'; }));
          await page.type('input[name="username"]', 'ui@example.test');
          await page.type('input[name="password"]', 'fixture-password');
          await page.click('button[type="submit"]');
          await page.waitForSelector('.crm-dashboard-page', { timeout: 30000 });
        }
        if (scenario === 'asset-retry') assert.equal(failedAssets, 1);
        assert.deepEqual(errors, [], scenario + ' raised a runtime error');
      }
      console.log('PASS ' + scenario);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
