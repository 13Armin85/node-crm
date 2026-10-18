// Verify real browser interactions against isolated API fixtures; run after client build.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('../server/node_modules/puppeteer');
async function main() {
  const build = path.resolve(__dirname, '../client/build');
  const artifacts = path.resolve(__dirname, '../layout-artifacts/crm-fixes');
  fs.mkdirSync(artifacts, { recursive: true });
  const server = http.createServer((req, res) => {
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '');
    let file = path.resolve(build, relative || 'index.html');
    if (!file.startsWith(build + path.sep)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(build, 'index.html');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser, page;
  try {
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true });
    page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const admin = { _id: '000000000000000000000001', role: 'admin', firstName: 'Admin' };
    const users = [admin, { _id: '000000000000000000000002', firstName: 'Second', lastName: 'User', role: 'user' }];
    const task = { _id: '100000000000000000000001', title: 'Assignment test', status: 'todo', priority: 'normal', category: 'None', createBy: admin._id, assignedToUser: admin._id };
    const contact = { _id: '200000000000000000000001', fullName: 'Contact fixture', phoneNumber: '123456789', createBy: admin._id };
    const meeting = { _id: '300000000000000000000001', agenda: 'Existing meeting', dateTime: '2026-10-20T10:00', related: 'None', attendes: [], attendesLead: [], createBy: admin._id };
    const field = (name, type, label, extra = {}) => ({ name, type, label: { en: label }, enabled: true, kind: 'SYSTEM_FIELD', order: 0, ...extra });
    const contactDefinition = { moduleName: 'Contacts', fields: [field('fullName', 'text', 'Full Name', { required: true }), field('phoneNumber', 'phone', 'Phone'), field('partnerCustomer', 'select', 'Partner Customer', { relation: 'Partner Customers' })] };
    const meetingDefinition = { moduleName: 'Meetings', fields: [field('agenda', 'text', 'Agenda', { required: true }), field('dateTime', 'datetime', 'Date and Time', { required: true })] };
    const meta = { _id: '400000000000000000000001', moduleName: 'Contacts', fields: [{ name: 'fullName', label: 'Full Name', isTableField: true, isView: true, type: 'text' }, { name: 'phoneNumber', label: 'Phone', isTableField: true, type: 'text' }] };
    let delegates = 0, savedContacts = 0, editedMeetings = 0;
    await page.setRequestInterception(true);
    page.on('request', async req => {
      const url = new URL(req.url());
      if (!url.pathname.startsWith('/api/')) { await req.continue().catch(() => {}); return; }
      let data = [], status = 200;
      const route = url.pathname;
      if (route === '/api/task' || route === '/api/task/') data = [task];
      if (route === '/api/task/assignees') data = users;
      if (route.startsWith('/api/task/edit/')) { delegates++; Object.assign(task, JSON.parse(req.postData())); data = task; }
      if (route === '/api/contact' || route === '/api/contact/') data = [contact];
      if (route.startsWith('/api/contact/view/')) data = { contact };
      if (route.startsWith('/api/custom-field')) data = [meta];
      if (route.startsWith('/api/estate/definitions/')) {
        const moduleName = decodeURIComponent(route.split('/').pop());
        data = moduleName === 'Contacts' ? contactDefinition : moduleName === 'Meetings' ? meetingDefinition : { moduleName, fields: [] };
      }
      if (route.endsWith('/options')) data = [{ value: '500000000000000000000001', label: 'Partner Company' }];
      if (route === '/api/form/add') {
        const body = JSON.parse(req.postData());
        if (body.fullName === 'Duplicate') { status = 409; data = { code: 'duplicate', field: 'fullName' }; }
        else { savedContacts++; data = { data: { ...body, _id: contact._id } }; }
      }
      if (route === '/api/meeting' || route === '/api/meeting/') data = [meeting];
      if (route.startsWith('/api/meeting/view/')) data = meeting;
      if (route.startsWith('/api/meeting/edit/')) { editedMeetings++; Object.assign(meeting, JSON.parse(req.postData())); data = meeting; }
      if (route.startsWith('/api/notification')) data = { notifications: [], unreadCount: 0, hasMore: false };
      await req.respond({ status, contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {});
    });
    const button = async text => page.evaluate(text => {
      const buttons = [...document.querySelectorAll('button')].filter(node => node.getClientRects().length && node.textContent.trim() === text);
      if (!buttons.length) throw new Error('Button missing: ' + text);
      buttons[buttons.length - 1].click();
    }, text);
    const input = async (selector, value) => page.$eval(selector, (node, text) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, text);
      node.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    const menuItem = async text => page.$$eval('[role=menuitem]', (nodes, text) => {
      const node = nodes.find(node => node.getClientRects().length && node.textContent.trim() === text);
      if (!node) throw new Error('Menu item missing: ' + text); node.click();
    }, text);
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(origin + '/auth', { waitUntil: 'networkidle0' });
    await page.waitForSelector('img[src$="brand-logo-ta.png"]');
    const token = Buffer.from('{}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture';
    await page.evaluate((admin, token) => { localStorage.setItem('user', JSON.stringify(admin)); localStorage.setItem('token', token); localStorage.setItem('crm-language', 'en'); }, admin, token);
    await page.goto(origin + '/task', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.crm-kanban-card select');
    await page.select('.crm-kanban-card select', users[1]._id);
    await page.waitForSelector('[role=alertdialog]'); assert.equal(delegates, 0);
    assert((await page.$eval('[role=alertdialog]', node => node.textContent)).includes('Second User'));
    await button('Cancel'); assert.equal(delegates, 0);
    await page.select('.crm-kanban-card select', users[1]._id);
    await page.waitForSelector('[role=alertdialog]'); await button('Confirm');
    await page.waitForFunction(() => !document.querySelector('[role=alertdialog]'));
    assert.equal(delegates, 1);
    await button('New Task'); await page.waitForSelector('select[name=priority]');
    await page.select('select[name=priority]', 'high');
    await page.waitForFunction(() => [...document.querySelectorAll('[role=dialog] [role=img]')].some(node => { const channels = getComputedStyle(node).backgroundColor.match(/\d+/g)?.map(Number); return channels && channels[0] > 200 && channels[1] < 140 && channels[2] < 140; }));
    assert(!(await page.$eval('[role=dialog]', node => node.textContent)).includes('Task priority controls'));
    await button('Close');
    console.log('PASS: delegation requires confirmation, cancel has no mutation, high priority shows a red swatch.');
    await page.goto(origin + '/contacts', { waitUntil: 'networkidle0' });
    await page.waitForSelector('tbody button[aria-haspopup=menu]');
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      await page.goto(origin + '/contacts', { waitUntil: 'networkidle0' });
      await page.waitForSelector('tbody button[aria-haspopup=menu]');
      await page.click('tbody button[aria-haspopup=menu]');
      await page.waitForFunction(() => [...document.querySelectorAll('[role=menu]')].some(node => node.getBoundingClientRect().width > 0 && getComputedStyle(node).visibility !== 'hidden' && Number(getComputedStyle(node).opacity) > 0.99));
      const geometry = await page.evaluate(() => { const node = [...document.querySelectorAll('[role=menu]')].find(node => node.getBoundingClientRect().width > 0 && getComputedStyle(node).visibility !== 'hidden' && Number(getComputedStyle(node).opacity) > 0.99); const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom, width: document.documentElement.scrollWidth, viewport: innerWidth, height: innerHeight, portal: Boolean(node.closest('.chakra-portal')) }; });
      assert(geometry.left >= -1 && geometry.right <= width + 1 && geometry.bottom <= geometry.height + 1, JSON.stringify(geometry));
      assert(geometry.width <= geometry.viewport, 'Menu causes horizontal page overflow'); assert(geometry.portal);
      await page.keyboard.press('Escape');
    }
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(origin + '/contacts', { waitUntil: 'networkidle0' });
    await page.waitForSelector('tbody button[aria-haspopup=menu]');
    await page.click('tbody button[aria-haspopup=menu]');
    await page.waitForFunction(() => [...document.querySelectorAll('[role=menuitem]')].some(node => node.textContent.trim() === 'Edit' && node.getClientRects().length)); await menuItem('Edit');
    await page.waitForSelector('#field-fullName');
    assert.equal(await page.$eval('#field-fullName', node => node.value), contact.fullName);
    await button('Close');
    await button('Add New'); await page.waitForSelector('#field-fullName'); await button('Save');
    await page.waitForSelector('#field-fullName[aria-invalid=true]');
    assert.equal(savedContacts, 0);
    assert((await page.$eval('[role=dialog]', node => node.textContent)).includes('Please complete the required fields'));
    await page.click('#field-partnerCustomer'); await page.type('#field-partnerCustomer', 'Partner');
    await page.waitForSelector('[role=option]', { visible: true });
    assert.equal(await page.$$eval('#field-partnerCustomer', nodes => nodes.length), 1);
    assert.equal(await page.$('select[name=partnerCustomer]'), null);
    await page.waitForFunction(() => [...document.querySelectorAll('[role=option]')].some(node => node.textContent === 'Partner Company' && getComputedStyle(node).visibility !== 'hidden'));
    await page.click('[role=option]');
    await page.waitForFunction(() => document.querySelector('#field-partnerCustomer').value === 'Partner Company');
    await input('#field-fullName', 'Duplicate'); await button('Save');
    await page.waitForFunction(() => document.querySelector('[role=dialog]')?.textContent.includes('Duplicate entries are not allowed'));
    assert.equal(await page.$eval('#field-fullName', node => node.value), 'Duplicate');
    await input('#field-fullName', 'New Contact'); await button('Save');
    await page.waitForFunction(() => !document.querySelector('#field-fullName')); assert.equal(savedContacts, 1);
    console.log('PASS: action menus stay inside desktop/mobile viewports, editing opens, required and duplicate errors retain values, relation uses one input, save succeeds.');
    await page.goto(origin + '/metting', { waitUntil: 'networkidle0' });
    await page.waitForSelector('tbody button[aria-haspopup=menu]'); await page.click('tbody button[aria-haspopup=menu]'); await menuItem('Edit');
    await page.waitForSelector('input[name=agenda]');
    await page.waitForFunction(() => document.querySelector('input[name=agenda]').value === 'Existing meeting');
    await input('input[name=agenda]', 'Edited meeting'); await button('Save');
    await page.waitForFunction(() => !document.querySelector('input[name=agenda]')); assert.equal(editedMeetings, 1);
    assert.equal(meeting.agenda, 'Edited meeting');
    console.log('PASS: meetings expose a working edit action.');
    for (const mode of ['light', 'dark']) {
      await page.evaluate(mode => { localStorage.setItem('chakra-ui-color-mode', mode); localStorage.setItem('crm-language', 'fa'); }, mode);
      await page.goto(origin + '/task', { waitUntil: 'networkidle0' });
      const logo = await page.$eval('.crm-sidebar-brand img', img => ({ loaded: img.complete && img.naturalWidth > 0, background: getComputedStyle(img).backgroundColor, source: img.getAttribute('src'), fit: getComputedStyle(img).objectFit }));
      assert(logo.loaded); assert.equal(logo.background, 'rgba(0, 0, 0, 0)'); assert.equal(logo.fit, 'contain'); assert(logo.source.endsWith('/brand-logo-ta.png'));
      await page.screenshot({ path: path.join(artifacts, 'kanban-' + mode + '.png') });
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log('PASS: supplied logo loads visibly in light and dark modes. Screenshots: ' + artifacts);
  } catch (error) {
    if (page) {
      console.error(await page.evaluate(() => ({ url: location.href, inputs: [...document.querySelectorAll('input[role=combobox]')].map(node => node.outerHTML), popovers: [...document.querySelectorAll('[role=listbox]')].map(node => ({ html: node.outerHTML, rect: node.getBoundingClientRect().toJSON(), visibility: getComputedStyle(node).visibility })), buttons: [...document.querySelectorAll('tbody button')].map(node => ({ html: node.outerHTML, rect: node.getBoundingClientRect().toJSON() })), menus: [...document.querySelectorAll('[role=menu]')].map(node => ({ html: node.outerHTML.slice(0, 500), rect: node.getBoundingClientRect().toJSON(), visibility: getComputedStyle(node).visibility })) })));
      await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {});
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
