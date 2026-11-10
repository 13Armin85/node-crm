const assert = require('node:assert/strict'), path = require('node:path');
exports.seed = require('./check-commission-tables.cjs').seed;
exports.check = async ({ page, origin, artifacts }) => {
  const keys = ['soldProperties', 'successfulIncome', 'lostIncome', 'unsoldProperties'];
  for (const [language, width, mode] of [['en', 1440, 'light'], ['fa', 375, 'light'], ['tr', 320, 'dark']]) {
    await page.goto(origin + '/default', { waitUntil: 'networkidle2' });
    await page.select('.crm-language-select select', language);
    await page.setViewport({ width, height: 950 });
    await page.evaluate(mode => localStorage.setItem('chakra-ui-color-mode', mode), mode);
    await page.goto(origin + '/default', { waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-finance-bucket="soldProperties"] .crm-currency__usd');
    const { data, rate } = await page.evaluate(async () => {
      const headers = { Authorization: localStorage.getItem('token') };
      const results = await Promise.all(['/api/estate/dashboard/finance', '/api/estate/dashboard/exchange-rate'].map(async url => {
        const response = await fetch(url, { headers }); if (!response.ok) throw new Error('Financial data unavailable'); return response.json();
      })); return { data: results[0], rate: results[1] };
    });
    const locale = ({ fa: 'fa-IR', tr: 'tr-TR' })[language] || 'en-US';
    const money = (amount, currency) => new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    assert.equal(await page.$$eval('[data-finance-bucket]', nodes => nodes.length), 4);
    for (const key of keys) {
      const lira = data[key].values.reduce((sum, value) => sum + value.amount * (value.currency === 'USD' ? rate.tryPerUsd : value.currency === 'EUR' ? rate.tryPerEur : 1), 0);
      const expected = { lira: money(lira, 'TRY'), dollar: money(lira / rate.tryPerUsd, 'USD') };
      await page.waitForFunction((key, expected) => {
        const root = document.querySelector('[data-finance-bucket="' + key + '"]');
        return root?.querySelector('.crm-currency__primary')?.textContent === expected.lira && root.querySelector('.crm-currency__usd')?.textContent.includes(expected.dollar);
      }, { timeout: 5000 }, key, expected);
    }
    assert(await page.$('.crm-team-sales-table'), 'Team ranking should remain on the dashboard');
    assert.equal(await page.$$eval('.crm-dashboard-stats .crm-stat-card', nodes => nodes.length), 4);
    assert.equal(await page.$$eval('.crm-dashboard-charts .crm-dashboard-panel', nodes => nodes.length), 2);
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 2, { timeout: 4000 });
    await page.screenshot({ path: path.join(artifacts, 'dashboard-conversion-' + language + '.png'), fullPage: true });
    console.log('PASS: four financial totals with mixed-currency TRY/USD conversion', language);
  }
};
