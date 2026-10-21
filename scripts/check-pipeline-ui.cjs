// Isolated browser fixtures; never writes to the live CRM.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const puppeteer = require('../server/node_modules/puppeteer');
async function main() {
  const root = path.resolve(process.env.CRM_BUILD_ROOT || path.join(__dirname, '../layout-artifacts/mobile-pwa/release'));
  const artifacts = path.resolve(__dirname, '../layout-artifacts/pipeline');
  fs.mkdirSync(artifacts, { recursive: true });
  const actor = { _id: '100000000000000000000001', firstName: 'Test', lastName: 'Admin', role: 'admin', username: 'admin@example.test' };
  const users = Array.from({ length: 13 }, (_, index) => ({ _id: '2000000000000000000000' + String(index).padStart(2, '0'),
    firstName: 'Person ' + (index + 1), lastName: 'Test', username: 'user' + (index + 1) + '@example.test', role: 'user' }));
  const stages = ['Discovery', 'Offer', 'Won'];
  const stageLabelsFa = ['کشف نیاز', 'پیشنهاد', 'موفق'];
  const deals = [{ _id: '300000000000000000000001', opportunityName: 'Deal One', salesStage: stages[0], createBy: actor._id, contactName: 'Jordan Lee', accountName2: 'North Estate', opportunityAmount: '125000', currency: 'USD', expectedCloseDate: '2026-11-15', assignUserName: 'Alex Morgan' },
    { _id: '300000000000000000000002', opportunityName: 'Deal Two', salesStage: stages[1], createBy: actor._id, contactName: 'Taylor Reed', opportunityAmount: '850000', currency: 'TRY', expectedCloseDate: '2026-12-01', assignUserName: 'Sam Parker' }];
  const lead = { _id: '400000000000000000000001', leadName: 'Prospect', leadStatus: 'active',
    createBy: { _id: users[0]._id, firstName: 'Original', lastName: 'Owner' } };
  const field = (name, type = 'text', extra = {}) => ({ name, type, kind: 'SYSTEM_FIELD', enabled: true,
    label: { en: name, fa: name, tr: name }, isView: name === 'leadName', isTableField: true, ...extra });
  let stageWrites = 0, userWrites = 0;
  const api = async (req, url) => {
    const route = decodeURIComponent(url.pathname).replace(/\/$/, '');
    let body = {};
    if (['PUT', 'POST'].includes(req.method)) { let raw = ''; for await (const chunk of req) raw += chunk; body = raw ? JSON.parse(raw) : {}; }
    if (route.startsWith('/api/opportunity/stage/') && req.method === 'PUT') {
      const deal = deals.find(record => route.endsWith(record._id)); assert(deal);
      assert(stages.includes(body.salesStage)); deal.salesStage = body.salesStage; stageWrites++; return deal;
    }
    if (route.startsWith('/api/user/edit/') && req.method === 'PUT') {
      const user = users.find(record => route.endsWith(record._id)); assert(user);
      Object.assign(user, body); userWrites++; return { user, message: 'Saved successfully' };
    }
    if (route === '/api/user') return { user: users };
    if (route === '/api/user/options' || route === '/api/task/assignees') return [actor, ...users];
    if (route.startsWith('/api/notification')) return { notifications: [], unreadCount: 0, hasMore: false };
    if (route === '/api/visibility/me') return { visibility: {}, accessibleModules: [] };
    if (route.startsWith('/api/visibility')) return { users, modules: ['Leads', 'Users', 'Opportunities', 'Tasks'] };
    if (route.startsWith('/api/record-sharing/')) return [];
    if (route === '/api/opportunity') return deals;
    if (route === '/api/lead') return [lead];
    if (route === '/api/custom-field') return [{ _id: '500000000000000000000001', moduleName: 'Leads', fields: [field('leadName')] }];
    if (route.startsWith('/api/estate/definitions/')) {
      const moduleName = route.split('/').pop();
      const fields = moduleName === 'Opportunities' ? [field('opportunityName'), field('salesStage', 'select', { options: stages.map((value, index) => ({ value, label: { en: value, fa: stageLabelsFa[index], tr: value } })) })]
        : moduleName === 'Users' ? [field('firstName'), field('lastName'), field('username', 'email'), field('phoneNumber', 'phone'), field('role', 'select', { options: ['user', 'admin'].map(value => ({ value, label: { en: value } })) })]
        : [field('leadName'), field('leadStatus', 'select', { options: [{ value: 'active', label: { en: 'Active' } }] })];
      return { moduleName, fields };
    }
    return [];
  };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const data = await api(req, url);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); return;
      }
      let file = path.resolve(root, decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html');
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    } catch (error) { res.writeHead(500); res.end(JSON.stringify({ error: error.message })); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const origin = 'http://127.0.0.1:' + server.address().port;
    await page.setRequestInterception(true);
    page.on('request', request => new URL(request.url()).origin === origin ? request.continue().catch(() => {}) : request.abort().catch(() => {}));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(origin + '/auth', { waitUntil: 'networkidle0' });
    const token = Buffer.from('{}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture';
    await page.evaluate((actor, token) => { localStorage.setItem('user', JSON.stringify(actor)); localStorage.setItem('token', token); localStorage.setItem('crm-language', 'en'); }, actor, token);
    await page.goto(origin + '/opportunities', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.crm-opportunity-column');
    assert.deepEqual(await page.$$eval('.crm-opportunity-column', nodes => nodes.map(node => node.dataset.stage)), stages);
    await page.select('.crm-opportunity-column[data-stage="Discovery"] select', 'Offer');
    await page.waitForFunction(() => document.querySelector('[data-stage="Offer"]').textContent.includes('Deal One'));
    assert.equal(stageWrites, 1);
    await page.focus('[data-rbd-drag-handle-draggable-id="300000000000000000000002"]');
    await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space');
    await page.waitForFunction(() => document.querySelector('[data-stage="Won"]').textContent.includes('Deal Two'));
    assert.equal(stageWrites, 2);
    assert.equal(await page.$$eval('.crm-opportunity-card__amount', nodes => nodes.length), 2);
    await page.screenshot({ path: path.join(artifacts, 'opportunity-kanban-desktop.png') });
    console.log('PASS: configured Kanban columns, stage selection and keyboard drag persist through the API');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
    assert(await page.$eval('.crm-opportunity-kanban', node => node.scrollWidth > node.clientWidth));
    await page.screenshot({ path: path.join(artifacts, 'opportunity-kanban-mobile.png') });
    console.log('PASS: the Kanban scrolls inside its board without mobile page overflow');
    await page.evaluate(() => localStorage.setItem('crm-language', 'fa'));
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.crm-opportunity-card');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).direction), 'ltr');
    assert(await page.$eval('.crm-opportunity-board__title', node => node.textContent.includes('مسیر فروش')));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(await page.$$eval('.crm-opportunity-column__title', nodes => nodes.map(node => node.textContent)), stageLabelsFa);
    await page.evaluate(() => {
      const board = document.querySelector('.crm-opportunity-board');
      window.scrollTo(0, window.scrollY + board.getBoundingClientRect().top - 90);
      board.querySelector('.crm-opportunity-kanban').scrollLeft = 292;
    });
    await page.screenshot({ path: path.join(artifacts, 'opportunity-kanban-persian-mobile.png') });
    await page.setViewport({ width: 1440, height: 1000, isMobile: false, hasTouch: false });
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.crm-opportunity-kanban').scrollLeft = 0; });
    await page.screenshot({ path: path.join(artifacts, 'opportunity-kanban-persian-desktop.png') });
    await page.evaluate(() => localStorage.setItem('chakra-ui-color-mode', 'dark'));
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.chakra-ui-dark .crm-opportunity-card');
    await page.screenshot({ path: path.join(artifacts, 'opportunity-kanban-persian-dark.png') });
    await page.evaluate(() => { localStorage.setItem('crm-language', 'en'); localStorage.setItem('chakra-ui-color-mode', 'light'); });
    console.log('PASS: Persian and dark-mode Kanban layouts preserve the application direction');

    await page.setViewport({ width: 1440, height: 1000, isMobile: false, hasTouch: false });
    await page.goto(origin + '/lead', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="lead-owner"]');
    assert((await page.$eval('[data-testid="lead-owner"]', node => node.textContent)).includes('Original Owner'));
    console.log('PASS: the lead displays its original creator as owner');
    console.log('CHECK: users list and page-two editing');
    await page.goto(origin + '/user', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.crm-record-row');
    await page.click('button[aria-label="Next Page"]');
    await page.waitForFunction(() => document.querySelector('button[aria-current="page"]').textContent === '2');
    await page.click('.crm-record-row .crm-record-menu-button');
    const definitionReady = page.waitForResponse(response => response.url().includes('/definitions/Users') && response.status() === 200);
    await page.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].find(node => node.textContent.trim() === 'Edit').click());
    await definitionReady;
    console.log('CHECK: user edit form loaded');
    await page.waitForSelector('.crm-record-form input[name="firstName"]', { visible: true });

    await page.focus('.crm-record-form input[name="firstName"]');
    await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
    await page.keyboard.type('Edited first');
    await page.click('.crm-record-form .chakra-modal__footer button');
    console.log('CHECK: user save requested');
    await page.waitForSelector('.crm-record-form', { hidden: true });
    await page.waitForFunction(() => [...document.querySelectorAll('.crm-record-row')].some(node => node.textContent.includes('Edited first')));
    assert.equal(await page.$eval('button[aria-current="page"]', node => node.textContent), '2');
    assert.equal(userWrites, 1);
    await page.waitForSelector('.Toastify__toast--success');
    await page.screenshot({ path: path.join(artifacts, 'user-edit-page-two.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: editing a user on page two keeps that page and shows the global success message');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
