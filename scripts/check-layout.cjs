// Run against the local development app with CRM_TEST_EMAIL and CRM_TEST_PASSWORD.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('../server/node_modules/puppeteer');

async function main() {
  assert(process.env.CRM_TEST_EMAIL && process.env.CRM_TEST_PASSWORD, 'Set CRM_TEST_EMAIL and CRM_TEST_PASSWORD');
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    pipe: true,
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto('http://localhost:3000/auth', { waitUntil: 'networkidle2' });
    await page.type('input[name="username"]', process.env.CRM_TEST_EMAIL);
    await page.type('input[name="password"]', process.env.CRM_TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.crm-shell', { timeout: 30000 });
    const role = await page.evaluate(() => JSON.parse(localStorage.getItem('user')).role);
    if (role === 'superAdmin') {
      await page.goto('http://localhost:3000/admin-setting', { waitUntil: 'networkidle2' });
      await page.waitForSelector('.chakra-stat__label');
    }
    const artifacts = path.join(__dirname, '../layout-artifacts');
    fs.mkdirSync(artifacts, { recursive: true });
    const measurements = [];
    for (const width of [1440, 1024, 390]) {
      await page.setViewport({ width, height: 1000 });
      for (const language of ['en', 'fa', 'tr']) {
        await page.select('.crm-header select', language);
        await page.waitForFunction(lang => document.documentElement.lang === lang, {}, language);
        for (const open of [false, true]) {
          const expanded = await page.$eval('.crm-sidebar-toggle', el => el.getAttribute('aria-expanded') === 'true');
          if (expanded !== open) await page.click('.crm-sidebar-toggle');
          await new Promise(resolve => setTimeout(resolve, 350));
          const geometry = await page.evaluate(() => {
            const rect = selector => {
              const r = document.querySelector(selector).getBoundingClientRect();
              return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
            };
            return {
              sidebar: rect('.crm-sidebar-shell'), main: rect('.crm-main'),
              content: rect('.crm-content'), toggle: rect('.crm-sidebar-toggle'),
              profile: rect('.crm-header-profile'), header: rect('.crm-header'),
              direction: document.documentElement.dir,
              pageWidth: document.documentElement.scrollWidth,
              logo: /prolink/i.test(document.body.innerText),
              settings: [...document.querySelectorAll('.chakra-stat__label')].map(el => el.innerText),
            };
          });
          const context = role + '/' + width + '/' + language + '/' + open;
          assert.equal(geometry.direction, 'ltr', context);
          assert.equal(geometry.sidebar.left, 0, context);
          assert(geometry.main.left >= geometry.sidebar.right - 1, 'Sidebar overlap: ' + context);
          assert(Math.abs(geometry.main.right - width) <= 1, 'Main width: ' + context);
          assert(geometry.toggle.right < geometry.profile.left, 'Header overlap: ' + context);
          assert(geometry.profile.right <= width, 'Profile clipped: ' + context);
          assert(geometry.content.top >= geometry.header.bottom, 'Content hidden by header: ' + context);
          assert(Math.abs((geometry.content.left + geometry.content.right) / 2 - (geometry.main.left + geometry.main.right) / 2) <= 1, 'Content not centered: ' + context);
          assert(geometry.pageWidth <= width, 'Page overflow: ' + context);
          assert.equal(geometry.logo, false, 'Logo remains: ' + context);
          if (role === 'superAdmin' && language !== 'en') {
            assert.equal(geometry.settings.length, 8, context);
            assert(!geometry.settings.some(text => ['Users', 'Roles', 'Change Images', 'Custom Fields', 'Validations', 'Table Fields', 'Module', 'Active Deactive Module'].includes(text)), 'Untranslated settings: ' + context);
          }
          measurements.push({ role, width, language, open, ...geometry });
          if (open && (width === 1440 && language === 'fa' || width === 390 && language === 'tr')) {
            await page.screenshot({ path: path.join(artifacts, role + '-' + width + '-' + language + '.png') });
          }
        }
      }
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
    fs.writeFileSync(path.join(artifacts, role + '.json'), JSON.stringify(measurements, null, 2));
    console.log('PASS: ' + role + ', 18 viewport/language/sidebar combinations, no runtime errors');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
