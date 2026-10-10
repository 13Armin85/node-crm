
// Run after npm run build in client. All API responses are isolated test fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('../server/node_modules/puppeteer');

async function main() {
  const root = path.resolve(process.env.CRM_BUILD_ROOT || path.join(__dirname, '../client/build'));
  assert(fs.existsSync(path.join(root, 'index.html')), 'Build the client first');
  const server = http.createServer((req, res) => {
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '');
    let file = path.resolve(root, relative || 'index.html');
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const origin = process.env.CRM_UI_ORIGIN || 'http://127.0.0.1:' + server.address().port;
    const user = { _id: '000000000000000000000001', role: 'admin', firstName: 'UI', lastName: 'Tester', username: 'ui@example.test' };
    const users = [
      { _id: '000000000000000000000002', firstName: 'علي', lastName: 'كريمي', username: 'ali@example.test', role: 'user' },
      { _id: '000000000000000000000003', firstName: 'İpek', lastName: 'Yılmaz', username: 'ipek@example.test', role: 'user' },
      { _id: '000000000000000000000004', firstName: 'John', lastName: 'Smith', username: 'john@example.test', role: 'user' },
    ];
    const tasks = users.map((person, index) => ({
      _id: '10000000000000000000000' + index, title: 'Task ' + index,
      assignedToUser: person._id, assignedToUserName: person.firstName + ' ' + person.lastName,
      createBy: user._id, status: 'todo', priority: 'normal', category: 'None',
    }));
    let unreadCount = 0;
    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = new URL(req.url());
      if (url.pathname.startsWith('/api/')) {
        let data = [];
        if (url.pathname === '/api/task') data = tasks;
        if (url.pathname === '/api/task/assignees') data = users;
        if (url.pathname.startsWith('/api/estate/definitions/')) data = { fields: [] };
        if (url.pathname.startsWith('/api/visibility')) data = { users, modules: ['Tasks', 'Contacts', 'Leads'] };
        if (url.pathname.startsWith('/api/notification')) data = {
          notifications: unreadCount ? [{ _id: '200000000000000000000001', type: 'task_assigned', message: 'Test notification', createdAt: new Date().toISOString(), readAt: null, link: '/task' }] : [],
          unreadCount, hasMore: false,
        };
        if (process.env.CRM_FORM_SETTINGS_ONLY) {
          if (url.pathname === '/api/estate/definitions') data = ['Properties', 'Leads'];
          if (url.pathname.startsWith('/api/estate/definitions/')) data = { moduleName: 'Properties', fields: [{ name: 'title', kind: 'SYSTEM_FIELD', type: 'text', label: { en: 'Title', fa: 'عنوان', tr: 'Başlık' }, enabled: true, options: [], order: 0 }] };
        }
        req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {});
      } else req.continue().catch(() => {});
    });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(origin + '/auth', { waitUntil: 'networkidle0' });
    await page.waitForSelector('img[src$="/brand-logo.png"]');
    assert(await page.$eval('img[src$="/brand-logo.png"]', img => img.complete && img.naturalWidth > 0), 'Login logo failed to load');
    assert(await page.$('link[rel="icon"][href$="/brand-logo.png"]'), 'Missing browser logo');
    const token = Buffer.from('{}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture';
    await page.evaluate((user, token) => { localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('token', token); localStorage.setItem('crm-language', 'en'); }, user, token);
    await page.goto(origin + '/task', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelectorAll('.crm-kanban-card').length === 3);
    assert(await page.$eval('.crm-sidebar-brand__mark img', img => img.complete && img.naturalWidth > 0), 'Sidebar logo failed');
    if (process.env.CRM_FORM_SETTINGS_ONLY) {
      for (const [language, width, role, settingsLabel, formLabel] of [
        ['fa', 1440, 'admin', 'تنظیمات مدیریت', 'مدیریت فرم‌ها'],
        ['en', 1440, 'developer', 'Admin Settings', 'Form Builder'],
        ['tr', 390, 'admin', 'Yönetici Ayarları', 'Form Düzenleyici'],
      ]) {
        await page.setViewport({ width, height: 1000 });
        await page.evaluate((language, role) => { localStorage.setItem('crm-language', language); localStorage.setItem('user', JSON.stringify({ ...JSON.parse(localStorage.getItem('user')), role })); }, language, role);
        await page.goto(origin + '/task', { waitUntil: 'networkidle0' });
        assert.equal(await page.$('#crm-sidebar a[href="/form-builder"]'), null, 'Form management must not appear in the sidebar');
        await page.click('.crm-profile-button');
        await page.waitForSelector('.crm-profile-menu [role="menuitem"]');
        await page.$$eval('.crm-profile-menu [role="menuitem"]', (items, label) => {
          const item = items.find(item => item.textContent.trim() === label); if (!item) throw new Error('Admin settings menu missing'); item.click();
        }, settingsLabel);
        await page.waitForSelector('.crm-settings-grid');
        assert.equal(new URL(page.url()).pathname, '/admin-setting');
        assert.equal(await page.$$eval('.crm-settings-grid .crm-stat-card', (cards, label) => cards.filter(card => card.textContent.trim() === label).length, formLabel), 1, 'Settings must contain one form management card');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Settings page overflows on mobile');
        await page.screenshot({ path: path.resolve(__dirname, '../layout-artifacts/forms-in-settings-' + language + '-' + width + '.png') });
        await page.$$eval('.crm-settings-grid .crm-stat-card', (cards, label) => cards.find(card => card.textContent.trim() === label).click(), formLabel);
        await page.waitForSelector('.form-builder-page');
        assert.equal(new URL(page.url()).pathname, '/form-builder');
        assert.equal(await page.$('#crm-sidebar a[href="/form-builder"]'), null);
        console.log('PASS: profile menu -> admin settings -> form builder, no sidebar entry: ' + role + '/' + language + '/' + width);
      }
      assert.deepEqual(errors, [], 'Browser runtime errors');
      return;
    }
    if (process.env.CRM_SIDEBAR_BRAND_ONLY) {
      for (const [language, width, mode] of [['fa', 1440, 'light'], ['en', 1440, 'dark'], ['tr', 390, 'light']]) {
        await page.setViewport({ width, height: 1000 });
        await page.evaluate((language, mode) => { localStorage.setItem('crm-language', language); localStorage.setItem('chakra-ui-color-mode', mode); }, language, mode);
        await page.goto(origin + '/task', { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => { const img = document.querySelector('.crm-sidebar-brand__mark img'); return img?.complete && img.naturalWidth > 0; });
        const measure = async () => page.$eval('.crm-sidebar-brand__mark', mark => {
          const style = getComputedStyle(mark), img = mark.querySelector('img');
          const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let transparent = 0, opaque = 0; for (let index = 3; index < pixels.length; index += 4) { if (pixels[index] === 0) transparent++; if (pixels[index] >= 200) opaque++; }
          return { background: style.backgroundColor, border: style.borderWidth, shadow: style.boxShadow, radius: style.borderRadius, fit: getComputedStyle(img).objectFit, transparent, opaque, total: canvas.width * canvas.height, source: img.getAttribute('src') };
        });
        const values = await measure();
        assert.equal(values.background, 'rgba(0, 0, 0, 0)'); assert.equal(values.border, '0px'); assert.equal(values.shadow, 'none'); assert.equal(values.radius, '0px'); assert.equal(values.fit, 'contain');
        assert(values.source.endsWith('/brand-logo-transparent.png'));
        assert(values.transparent > values.total * 0.25 && values.opaque > 0, 'Logo is missing real transparent alpha');
        if (width < 1280) { await page.click('.crm-sidebar-toggle'); await page.waitForSelector('.crm-shell[data-sidebar-open="true"]'); }
        await page.screenshot({ path: path.resolve(__dirname, '../layout-artifacts/sidebar-logo-' + language + '-' + width + '-' + mode + '.png') });
        console.log('PASS sidebar: ' + language + '/' + width + '/' + mode + ' / transparent pixels ' + values.transparent + '/' + values.total);
        if (width >= 1280) { await page.click('.crm-sidebar-toggle'); await page.waitForSelector('.crm-shell[data-sidebar-open="false"]'); assert.deepEqual(await measure(), values); }
      }
      assert.deepEqual(errors, [], 'Browser runtime errors');
      console.log('PASS: transparent logo with no background, border or shadow in expanded/collapsed sidebar and mobile.');
      return;
    }
    const changeInput = async (selector, value) => page.$eval(selector, (input, next) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    const button = async label => page.evaluate(text => {
      const target = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text);
      if (!target) throw new Error('Button not found: ' + text);
      target.click();
    }, label);
    for (const mode of ['Kanban', 'List']) {
      await button(mode);
      const rows = mode === 'Kanban' ? '.crm-kanban-card' : 'tbody tr:has(.selectOpt)';
      for (const [query, expected] of [['علی کریمی', 'Task 0'], ['IPEK YILMAZ', 'Task 1'], ['JOHN SMITH', 'Task 2']]) {
        await changeInput('.crm-task-searchbar input', query);
        await page.waitForFunction(selector => document.querySelectorAll(selector).length === 1, {}, rows);
        assert((await page.$eval(rows, row => row.textContent)).includes(expected), 'Wrong name search result: ' + mode + ' / ' + query);
      }
      await changeInput('.crm-task-searchbar input', 'missing-name');
      await page.waitForFunction(selector => document.querySelectorAll(selector).length === 0, {}, rows);
      await changeInput('.crm-task-searchbar input', '');
      await page.waitForFunction(selector => document.querySelectorAll(selector).length === 3, {}, rows);
    }
    console.log('PASS: multilingual search, missing names and clearing queries in Kanban and List.');
    await button('Kanban');
    assert.equal(await page.$('.crm-kanban-card input'), null, 'Task cards must not contain a search box');
    assert.equal(await page.$$eval('.crm-kanban-card select', selects => selects.length), 3, 'Assignee dropdowns must remain available');
    if (process.env.CRM_TASK_CARDS_ONLY) {
      for (const [language, width] of [['fa', 1440], ['fa', 390], ['tr', 390]]) {
        await page.setViewport({ width, height: 1000 });
        await page.evaluate(language => localStorage.setItem('crm-language', language), language);
        await page.goto(origin + '/task', { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.querySelectorAll('.crm-kanban-card').length === 3);
        assert.equal(await page.$('.crm-kanban-card input'), null, 'Search box remained inside a task card');
        assert.equal(await page.$$eval('.crm-kanban-card select', selects => selects.length), 3);
        assert(await page.$('.crm-task-searchbar input'), 'Main task search missing');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile task page overflows');
        await changeInput('.crm-task-searchbar input', 'IPEK YILMAZ');
        await page.waitForFunction(() => document.querySelectorAll('.crm-kanban-card').length === 1);
        assert((await page.$eval('.crm-kanban-card', card => card.textContent)).includes('Task 1'));
        await changeInput('.crm-task-searchbar input', '');
        await page.waitForFunction(() => document.querySelectorAll('.crm-kanban-card').length === 3);
        await page.screenshot({ path: path.resolve(__dirname, '../layout-artifacts/task-no-card-search-' + language + '-' + width + '.png') });
      }
      assert.deepEqual(errors, [], 'Browser runtime errors');
      console.log('PASS: no search boxes inside cards; assignee dropdowns and main multilingual search work on desktop/mobile.');
      return;
    }
    const dot = () => page.$eval('.crm-header-icon-button', button => getComputedStyle(button, '::after').content);
    assert.equal(await dot(), 'none', 'Bell dot visible with an empty inbox');
    unreadCount = 1;
    await page.evaluate(() => window.dispatchEvent(new Event('crm:notifications-changed')));
    await page.waitForSelector('.crm-header-icon-button[data-unread="true"]');
    assert.notEqual(await dot(), 'none', 'Bell dot missing for an unread notification');
    unreadCount = 0;
    await page.evaluate(() => window.dispatchEvent(new Event('crm:notifications-changed')));
    await page.waitForSelector('.crm-header-icon-button[data-unread="false"]');
    assert.equal(await dot(), 'none', 'Bell dot remained after notifications were read');
    const artifacts = path.resolve(__dirname, '../layout-artifacts');
    fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, 'task-branding-ui.png') });
    for (const [language, width, colorMode] of [['fa', 1440, 'light'], ['en', 1440, 'light'], ['tr', 390, 'dark'], ['fa', 390, 'dark']]) {
      await page.setViewport({ width, height: 1000 });
      await page.evaluate((language, colorMode) => { localStorage.setItem('crm-language', language); localStorage.setItem('chakra-ui-color-mode', colorMode); }, language, colorMode);
      await page.goto(origin + '/data-visibility', { waitUntil: 'networkidle0' });
      await page.waitForSelector('#visibility-user');
      await page.select('#visibility-user', users[0]._id);
      await page.waitForSelector('.chakra-switch__thumb');
      const checkGeometry = async () => {
        const measurements = await page.$$eval('.chakra-switch__track', tracks => tracks.map(track => {
          const outer = track.getBoundingClientRect(), inner = track.querySelector('.chakra-switch__thumb').getBoundingClientRect();
          return { contained: inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom, outerWidth: outer.width, thumbWidth: inner.width };
        }));
        assert(measurements.every(item => item.contained), 'Switch thumb outside track: ' + language + '/' + width + '/' + colorMode + ' ' + JSON.stringify(measurements));
      };
      await checkGeometry();
      await page.click('label.chakra-switch');
      // Wait for the CSS transform transition before measuring the unchecked state.
      await page.waitForFunction(() => Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.chakra-switch__thumb')).transform).m41) < 0.01);
      await checkGeometry();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Visibility page overflows on mobile');
      await page.screenshot({ path: path.join(artifacts, 'visibility-' + language + '-' + width + '-' + colorMode + '.png') });
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log('PASS: login/sidebar branding, multilingual task search in both views, card assignee dropdowns without search boxes, notification transitions, and switch geometry in Persian/English/Turkish on desktop/mobile.');
  } finally {
    if(browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
