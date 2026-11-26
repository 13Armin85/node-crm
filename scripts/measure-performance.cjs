// Read-only live measurements. Only a short-lived verification session is created.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const mongoose = require('../server/node_modules/mongoose');
const puppeteer = require('../server/node_modules/puppeteer');
require('../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../server/.env'), quiet: true });
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const label = option('--label', 'current').replace(/[^a-z0-9-]/gi, '_');
const origin = option('--origin', 'https://37.148.206.74');
const build = path.resolve(option('--build', path.join(__dirname, '../client/build')));
const destination = path.resolve(__dirname, '../layout-artifacts/performance-' + label + '.json');

async function main() {
  let browser, sessionId;
  try {
    await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017', { dbName: process.env.DB || 'Prolink', autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 });
    const actor = await mongoose.connection.collection('User').findOne({ role: { $in: ['developer', 'admin'] }, deleted: false }, { projection: { _id: 1, role: 1, authVersion: 1 } });
    if (!actor) throw new Error('An active administrator is required');
    sessionId = crypto.randomBytes(32).toString('hex');
    await mongoose.connection.collection('Session').insertOne({ _id: sessionId, userId: actor._id, rememberMe: false, createdAt: new Date(), expiresAt: new Date(Date.now() + 15 * 60 * 1000), revokedAt: null, userAgent: 'CRM performance verifier' });
    const token = require('../server/node_modules/jsonwebtoken').sign({ userId: actor._id, sv: actor.authVersion || 0, sid: sessionId }, require('../server/config/auth').jwtSecret, { expiresIn: '15m' });
    const manifest = JSON.parse(await fs.readFile(path.join(build, 'asset-manifest.json'), 'utf8'));
    const entrypoints = await Promise.all(manifest.entrypoints.map(async file => {
      const bytes = await fs.readFile(path.join(build, file));
      return { file, bytes: bytes.length, gzipBytes: zlib.gzipSync(bytes).length, brotliBytes: zlib.brotliCompressSync(bytes).length };
    }));
    const api = [];
    for (const route of ['/estate/definitions/Properties', '/estate/dashboard/finance', '/reporting/line-chart', '/status/', ...(label === 'after' ? ['/status/?summary=1'] : []), '/notification']) {
      const samples = [];
      let bytes, status, encoding;
      for (let repeat = 0; repeat < 3; repeat++) {
        const start = performance.now();
        const response = await fetch(origin + '/api' + route, { headers: { Authorization: token, 'Accept-Encoding': 'gzip' }, signal: AbortSignal.timeout(30000) });
        bytes = (await response.arrayBuffer()).byteLength;
        status = response.status; encoding = response.headers.get('content-encoding');
        samples.push(Math.round(performance.now() - start));
      }
      api.push({ route, status, decodedBytes: bytes, encoding, samplesMS: samples });
    }
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true, args: ['--no-sandbox', '--disable-gpu'] });
    const pages = [];
    for (const [route, selector, authenticated] of [['/auth/sign-in', 'input[name="username"], input[type="email"]', false], ['/default', '.crm-dashboard-hero', true], ['/task', '.crm-agenda__toolbar', true], ['/properties', '.crm-entity-page', true]]) {
      const context = await browser.createBrowserContext();
      try {
        const page = await context.newPage();
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
        await page.setCacheEnabled(false);
        const cdp = await page.createCDPSession();
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: 375000, uploadThroughput: 125000, connectionType: 'cellular4g' });
        await page.evaluateOnNewDocument((user, token, authenticated) => {
          localStorage.setItem('crm-language', 'fa');
          if (authenticated) { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); }
          window.__crmPerf = { longTasks: [], lcp: 0 };
          new PerformanceObserver(list => list.getEntries().forEach(entry => window.__crmPerf.longTasks.push(entry.duration))).observe({ type: 'longtask', buffered: true });
          new PerformanceObserver(list => list.getEntries().forEach(entry => { window.__crmPerf.lcp = entry.startTime; })).observe({ type: 'largest-contentful-paint', buffered: true });
        }, { _id: String(actor._id), role: actor.role, firstName: 'Performance check' }, token, authenticated);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForSelector(selector, { timeout: 90000 });
        await page.waitForNetworkIdle({ idleTime: 600, timeout: 30000 }).catch(() => {});
        const result = await page.evaluate(() => {
          const resources = performance.getEntriesByType('resource');
          const scripts = resources.filter(item => item.initiatorType === 'script');
          return {
            domContentLoadedMS: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd),
            lcpMS: Math.round(window.__crmPerf.lcp), totalBlockingMS: Math.round(window.__crmPerf.longTasks.reduce((sum, time) => sum + Math.max(0, time - 50), 0)),
            jsDecodedBytes: scripts.reduce((sum, item) => sum + item.decodedBodySize, 0), jsTransferBytes: scripts.reduce((sum, item) => sum + item.transferSize, 0), scriptRequests: scripts.length,
            apiRequests: resources.filter(item => item.name.includes('/api/')).length,
            overflow: document.documentElement.scrollWidth > innerWidth + 2,
          };
        });
        pages.push({ route, ...result, browserErrors: errors });
        console.log(JSON.stringify({ route, ...result, browserErrors: errors.length }));
      } finally { await context.close(); }
    }
    const report = { label, origin, measuredAt: new Date().toISOString(), mobile: { width: 390, cpuSlowdown: 4, downloadBytesPerSecond: 375000, latencyMS: 80, coldCache: true }, entrypoints, api, pages };
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, JSON.stringify(report, null, 2));
    console.log('Saved measurements: ' + destination);
  } finally {
    if (browser) await browser.close();
    if (sessionId) await mongoose.connection.collection('Session').deleteOne({ _id: sessionId }).catch(() => {});
    await mongoose.disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
