// Read-only browser verification against the deployed dashboard and live exchange rate.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const mongoose = require('../server/node_modules/mongoose');
const puppeteer = require('../server/node_modules/puppeteer');
require('../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../server/.env'), quiet: true });
async function main() {
  let browser;
  const artifacts = path.resolve(__dirname, '../layout-artifacts/published-dashboard');
  const origin = process.env.CRM_UI_ORIGIN || 'https://37.148.206.74';
  try {
    await fs.mkdir(artifacts, { recursive: true });
    await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017', { dbName: process.env.DB || 'Prolink', autoIndex: false, autoCreate: false });
    const actor = await mongoose.connection.collection('User').findOne({ role: { $in: ['developer', 'admin'] }, deleted: false }, { projection: { _id: 1, role: 1, authVersion: 1 } });
    assert(actor, 'An active administrator is required');
    const token = require('../server/node_modules/jsonwebtoken').sign({ userId: actor._id, sv: actor.authVersion || 0 }, require('../server/config/auth').jwtSecret, { expiresIn: '5m' });
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true, pipe: true, args: ['--no-sandbox', '--disable-gpu'], userDataDir: path.join(artifacts, 'profile') });
    const page = await browser.newPage();
    const errors = [], failedApi = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().includes('/api/estate/dashboard/') && response.status() >= 400) failedApi.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    await page.goto(origin + '/auth', { waitUntil: 'networkidle2' });
    await page.evaluate((actor, token) => {
      localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(actor));
      localStorage.setItem('crm-language', 'en');
    }, { _id: String(actor._id), role: actor.role, firstName: 'Release check' }, token);
    const checked = [];
    for (const [language, width, mode] of [['en', 1440, 'light'], ['fa', 390, 'light'], ['tr', 320, 'dark']]) {
      await page.evaluate(({ language, mode }) => { localStorage.setItem('crm-language', language); localStorage.setItem('chakra-ui-color-mode', mode); }, { language, mode });
      await page.setViewport({ width, height: 950 });
      await page.goto(origin + '/default', { waitUntil: 'networkidle2' });
      await page.waitForSelector('[data-finance-bucket="soldProperties"] .crm-currency__usd', { timeout: 30000 });
      const result = await page.evaluate(async () => {
        const headers = { Authorization: localStorage.getItem('token') };
        const [finance, rate] = await Promise.all(['/api/estate/dashboard/finance', '/api/estate/dashboard/exchange-rate'].map(async url => {
          const response = await fetch(url, { headers }); if (!response.ok) throw new Error('Published API failed: ' + response.status); return response.json();
        }));
        const language = localStorage.getItem('crm-language');
        const locale = { fa: 'fa-IR', tr: 'tr-TR', en: 'en-US' }[language];
        const money = (value, currency) => new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
        const keys = ['soldProperties', 'successfulIncome', 'lostIncome', 'unsoldProperties'];
        const totalsCorrect = keys.every(key => {
          let lira = 0, dollar = 0;
          for (const value of finance[key].values) {
            const converted = value.amount * (value.currency === 'USD' ? rate.tryPerUsd : value.currency === 'EUR' ? rate.tryPerEur : 1);
            lira += converted; dollar += value.currency === 'USD' ? value.amount : converted / rate.tryPerUsd;
          }
          const root = document.querySelector('[data-finance-bucket="' + key + '"]');
          return root.querySelector('.crm-currency__primary')?.textContent === money(lira, 'TRY') && root.querySelector('.crm-currency__usd')?.textContent.includes(money(dollar, 'USD'));
        });
        return { cards: document.querySelectorAll('[data-finance-bucket]').length, totalsCorrect, overflow: document.documentElement.scrollWidth > innerWidth + 2,
          hero: Boolean(document.querySelector('.crm-dashboard-hero')), counters: document.querySelectorAll('.crm-dashboard-stats .crm-stat-card').length,
          charts: document.querySelectorAll('.crm-dashboard-charts .crm-dashboard-panel').length, statistics: document.querySelectorAll('.crm-dashboard-statistic').length,
          leadStatistics: Boolean(document.querySelector('.crm-lead-chart .crm-radial-chart')), taskStatuses: document.querySelectorAll('.crm-dashboard-task-status').length,
          teamRanking: Boolean(document.querySelector('.crm-team-sales-table')),
          untranslated: document.querySelector('.crm-sales-performance').textContent.includes('finance.'), rateAvailable: rate.tryPerUsd > 0 && rate.tryPerEur > 0 };
      });
      assert.equal(result.cards, 4); assert(result.totalsCorrect); assert(result.rateAvailable); assert(!result.overflow); assert(!result.untranslated);
      assert(result.hero); assert.equal(result.counters, 4); assert.equal(result.charts, 2); assert(result.statistics > 0);
      assert(result.leadStatistics); assert.equal(result.taskStatuses, 5); assert(result.teamRanking);
      await page.screenshot({ path: path.join(artifacts, language + '-' + width + '.png'), fullPage: true });
      checked.push({ language, width, mode, ...result });
      console.log('PASS: published dashboard', language, width, 'all original sections, four financial totals, live TRY/USD conversion, no overflow');
    }
    const selects = await page.$$('.crm-sales-performance select');
    assert.equal(selects.length, 3, 'Income and team ranking filters must remain available');
    let changed = page.waitForResponse(response => response.url().includes('/api/estate/dashboard/finance?period=month'));
    await selects[0].select('month');
    assert.equal((await changed).status(), 200, 'Income period filter failed');
    changed = page.waitForResponse(response => response.url().includes('/api/estate/dashboard/sales-summary?') && response.url().includes('currency=USD'));
    await selects[1].select('USD');
    assert.equal((await changed).status(), 200, 'Ranking currency filter failed');
    changed = page.waitForResponse(response => response.url().includes('/api/estate/dashboard/sales-summary?') && response.url().includes('teamMonths=6'));
    await selects[2].select('6');
    assert.equal((await changed).status(), 200, 'Ranking period filter failed');
    assert.equal(await page.$$eval('[data-finance-bucket]', nodes => nodes.length), 4);
    console.log('PASS: restored income period, team currency and ranking period controls');
    assert.deepEqual(errors, []); assert.deepEqual(failedApi, []);
    await fs.writeFile(path.join(artifacts, 'verification.json'), JSON.stringify({ origin, checkedAt: new Date().toISOString(), checked, browserErrors: errors, failedApi }, null, 2));
  } finally {
    if (browser) await browser.close();
    await mongoose.disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
