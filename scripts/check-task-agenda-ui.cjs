// Run after the client build. API fixtures keep this check independent of CRM data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('../server/node_modules/puppeteer');

async function main() {
  const root = path.resolve(process.env.CRM_BUILD_ROOT || path.join(__dirname, '../client/build'));
  const artifacts = path.resolve(__dirname, '../layout-artifacts/task-agenda');
  fs.mkdirSync(artifacts, { recursive: true });
  const server = http.createServer((req, res) => {
    let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const user = { _id: '000000000000000000000001', role: 'admin', firstName: 'سامان', lastName: 'بهجت' };
    const localDate = offset => { const d = new Date(); d.setDate(d.getDate() + offset); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
    const titles = ['تماس با مشتری', 'بازدید آپارتمان', 'ارسال قرارداد', 'پرداخت قسط', 'پیگیری پیشنهاد', 'یادآوری تمدید'];
    const kinds = ['call', 'visit', 'document', 'payment', 'followup', 'reminder'];
    const priorities = ['urgent', 'high', 'normal', 'low', 'normal', 'low'];
    const tasks = titles.map((title, i) => ({
      _id: '10000000000000000000000' + i, title, assignedToUser: user._id, createBy: user._id,
      assignedToUserName: 'سامان بهجت', assignToName: 'مریم احمدی', category: 'Contact',
      description: 'هماهنگی زمان و بررسی اطلاعات مورد نیاز مخاطب', priority: priorities[i],
      status: i === 0 ? 'inProgress' : 'todo', start: localDate(i === 0 ? -1 : 0) + ' 14:30',
    }));
    await page.setRequestInterception(true);
    page.on('request', req => {
      const route = new URL(req.url()).pathname;
      if (!route.startsWith('/api/')) { req.continue().catch(() => {}); return; }
      let data = [];
      if (route === '/api/task' || route === '/api/task/') data = tasks;
      if (route === '/api/task/assignees') data = [user];
      if (route.startsWith('/api/notification')) data = { notifications: [], unreadCount: 0, hasMore: false };
      if (route.startsWith('/api/estate/definitions/')) data = { moduleName: route.split('/').pop(), fields: [
        { kind: 'CUSTOM_FIELD', name: 'relatedContact', type: 'select', relation: 'Contacts', label: { fa: 'مخاطب مرتبط', en: 'Related contact', tr: 'İlgili kişi' }, enabled: true, order: 99 },
      ] };
      if (route.endsWith('/options')) data = [{ value: '200000000000000000000001', label: 'مریم احمدی' }];
      req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {});
    });
    const origin = 'http://127.0.0.1:' + server.address().port;
    await page.goto(origin + '/auth', { waitUntil: 'networkidle0' });
    const token = Buffer.from('{}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture';
    await page.evaluate((user, token) => { localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('token', token); }, user, token);
    for (const [language, width, mode] of [['fa', 1440, 'light'], ['fa', 390, 'light'], ['fa', 390, 'dark'], ['en', 1440, 'light'], ['tr', 390, 'light']]) {
      await page.setViewport({ width, height: 1000 });
      await page.evaluate((language, mode) => { localStorage.setItem('crm-language', language); localStorage.setItem('chakra-ui-color-mode', mode); }, language, mode);
      await page.goto(origin + '/task', { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => document.querySelectorAll('.crm-agenda-row').length === 6);
      assert.deepEqual(await page.$$eval('.crm-agenda-row', rows => rows.map(row => row.dataset.kind)), kinds);
      assert(await page.$$eval('.crm-agenda-row__related', nodes => nodes.every(node => node.textContent.includes('مریم احمدی'))));
      assert(await page.$$eval('.crm-agenda-row__assignee', nodes => nodes.every(node => node.textContent.includes('سامان بهجت'))));
      assert(await page.$eval('.crm-agenda-chip--advisor', button => {
        const label = button.querySelector('span span').getBoundingClientRect(), arrow = button.querySelector('svg').getBoundingClientRect();
        return Math.abs((label.y + label.height / 2) - (arrow.y + arrow.height / 2)) < 2;
      }), 'Advisor arrow must stay beside its label');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page overflows on mobile');
      await page.screenshot({ path: path.join(artifacts, `${language}-${width}-${mode}.png`), fullPage: true });
      await page.select('.crm-agenda__filters select', 'urgent');
      await page.waitForFunction(() => document.querySelectorAll('.crm-agenda-row').length === 1);
      await page.click('.crm-agenda__clear');
      await page.type('.crm-agenda__search input', 'مريم احمدي');
      await page.waitForFunction(() => document.querySelectorAll('.crm-agenda-row').length === 6);
      await page.click('.crm-agenda__clear');
      await page.click('.crm-agenda__actions button');
      await page.waitForSelector('[role="dialog"] .crm-searchable-select');
      const arrows = await page.$$eval('[role="dialog"] .chakra-select__wrapper', wrappers => wrappers.map(wrapper => {
        const select = wrapper.querySelector('select'), icon = wrapper.querySelector('.chakra-select__icon-wrapper');
        if (!select || !icon) return null;
        const a = select.getBoundingClientRect(), b = icon.getBoundingClientRect(), style = getComputedStyle(select);
        return { arrowOnLeft: b.x < a.x + a.width / 2, leftPadding: parseFloat(style.paddingLeft), rightPadding: parseFloat(style.paddingRight) };
      }).filter(Boolean));
      assert(arrows.length > 0);
      for (const arrow of arrows) {
        assert.equal(arrow.arrowOnLeft, language === 'fa', 'Dropdown arrow has the wrong direction');
        assert(language === 'fa' ? arrow.leftPadding >= 32 : arrow.rightPadding >= 24, 'Dropdown arrow overlaps text');
      }
      const picker = await page.$eval('.crm-searchable-select', node => {
        const input = node.querySelector('input'), icon = node.querySelector('.chakra-input__right-element');
        const a = input.getBoundingClientRect(), b = icon.getBoundingClientRect(), style = getComputedStyle(input);
        return { left: b.x < a.x + a.width / 2, leftPadding: parseFloat(style.paddingLeft), rightPadding: parseFloat(style.paddingRight), width: b.width };
      });
      assert.equal(picker.left, language === 'fa');
      assert((language === 'fa' ? picker.leftPadding : picker.rightPadding) >= picker.width, 'Relation picker overlaps placeholder');
      await page.screenshot({ path: path.join(artifacts, `form-${language}-${width}-${mode}.png`), fullPage: true });
      console.log(`PASS agenda details, icons, filters, layout and form dropdowns: ${language}/${width}/${mode}`);
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
