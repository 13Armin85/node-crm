// Exercise the staged client with the real API and an isolated, disposable DB.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const mongoose = require('../server/node_modules/mongoose');
const express = require('../server/node_modules/express');
const jwt = require('../server/node_modules/jsonwebtoken');
const puppeteer = require('../server/node_modules/puppeteer');
require('../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../server/.env'), quiet: true });

async function main() {
  const dbName = 'crm_compact_browser_test_' + crypto.randomUUID().replace(/-/g, '');
  const build = path.resolve(__dirname, process.env.CRM_CHECK_RELEASE_DIRECTORY || '../layout-artifacts/compact-workspace/release');
  const artifacts = path.resolve(__dirname, process.env.CRM_CHECK_ARTIFACT_DIRECTORY || '../layout-artifacts/compact-workspace');
  assert(fs.existsSync(path.join(build, 'index.html')), 'Build the staged client first');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  mongoose.set('strictQuery', false);
  let server, browser, page;
  try {
    const app = express(); app.use(express.json()); app.use('/api', require('../server/controllers/route'));
    app.use(express.static(build)); app.get('*', (req, res) => res.sendFile(path.join(build, 'index.html')));
    const User = require('../server/model/schema/user');
    const CustomField = require('../server/model/schema/customField');
    const { Contact, initializeContactSchema } = require('../server/model/schema/contact');
    const { Lead, initializeLeadSchema } = require('../server/model/schema/lead');
    const { Property, initializePropertySchema } = require('../server/model/schema/property');
    const Opportunity = require('../server/model/schema/opprtunity');
    const Document = require('../server/model/schema/document');
    await CustomField.create({ moduleName: 'Contacts', isDefault: true, fields: [
      ...['createBy', 'createdDate', 'updatedDate', 'deleted'].map(name => ({ name, backendType: 'Mixed' })),
      ...require('../server/db/contactFields').contactFields,
    ] });
    await CustomField.create({ moduleName: 'Leads', isDefault: true, fields: require('../server/db/leadFields').leadFields });
    await CustomField.create({ moduleName: 'Properties', isDefault: true, fields: require('../server/db/propertiesFields').propertiesFields });
    await initializeContactSchema(); await initializeLeadSchema(); await initializePropertySchema();
    const actor = await User.create({ username: 'compact-browser@example.test', firstName: 'Workspace', lastName: 'Reviewer', role: 'developer', password: 'unused-test-only' });
    const user = { _id: String(actor._id), firstName: actor.firstName, lastName: actor.lastName, role: actor.role };
    if (process.env.CRM_CHECK_SETTINGS) await require('./check-settings-workspace.cjs').seed({ actor, User });
    const token = jwt.sign({ userId: actor._id }, require('../server/config/auth').jwtSecret, { expiresIn: '15m' });
    const contacts = [];
    for (let index = 1; index <= 14; index++) contacts.push(await Contact.create({ fullName: 'Customer ' + String(index).padStart(2, '0'),
      email: `customer${index}@example.test`, phoneNumber: '+90 555 100 ' + index, createBy: actor._id, deleted: false, createdDate: new Date() }));
    const property = await Property.create({ title: 'Garden Villa', category: 'RESIDENTIAL', subtype: 'VILLA', transactionType: 'SALE',
      district: 'Sariyer', propertyOwner: contacts[0]._id, createBy: actor._id });
    const leads = [];
    for (const mode of ['contact', 'contactAndOpportunity']) leads.push(await Lead.create({ leadName: 'Transfer ' + mode,
      leadEmail: mode + '@example.test', leadMobile: '+90 555 ' + (mode === 'contact' ? '201' : '202'),
      leadMessage: 'Original complete message ' + mode, leadNotes: 'Original follow-up notes ' + mode,
      customFields: { reference: 'Original custom value ' + mode, budget: 0 }, associatedListing: property._id,
      assignUser: actor._id, createBy: actor._id, deleted: false, createdDate: new Date() }));
    let longTask;
    if (process.env.CRM_CHECK_DASHBOARD_TASKS || process.env.CRM_CHECK_DIALOG_CONTROLS) {
      const Task = require('../server/model/schema/task');
      const assignee = await User.create({ username: 'task-assignee@example.test', firstName: 'مسئول پیگیری مشتریان و هماهنگی بازدید املاک',
        lastName: 'با نام کامل و طولانی برای بررسی نمایش بدون سه نقطه', role: 'user', password: 'unused-test-only' });
      const relatedName = 'مشتری مرتبط با نام بسیار طولانی برای هماهنگی و برنامه‌ریزی بازدید از تمام املاک پیشنهادی';
      // Include a legacy contact with its original split name, as used by task labels.
      const related = await Contact.collection.insertOne({ fullName: relatedName, firstName: relatedName, lastName: '',
        createBy: actor._id, deleted: false, createdDate: new Date('2000-01-01') });
      longTask = {
        title: 'هماهنگی بازدید مشتری و پیگیری تمام مراحل قرارداد با توضیح عنوان بسیار طولانی که باید به صورت کامل در کارت وظیفه نمایش داده شود — پایان عنوان',
        description: ('این توضیحات طولانی شامل تمام اطلاعات مورد نیاز برای پیگیری مشتری، هماهنگی با مالک و ثبت نتیجه تماس است و هیچ بخشی از آن نباید مخفی شود. ').repeat(5)
          + '\nhttps://example.test/' + 'VeryLongUnbrokenReference'.repeat(7) + '\nپایان کامل توضیحات',
        assignedToUserName: assignee.firstName + ' ' + assignee.lastName,
        assignToName: relatedName,
      };
      await Task.create({ title: longTask.title, description: longTask.description, assignedToUser: assignee._id, category: 'Contact', assignTo: related.insertedId,
        createBy: actor._id, status: 'todo', priority: 'high', start: '2026-10-29', end: '2026-11-02', createdDate: new Date(), deleted: false });
      await Task.create({ title: 'Completed follow-up', description: 'Review completed', createBy: actor._id, status: 'completed', priority: 'normal', deleted: false });
    }
    await Document.create({ folderName: '__ROOT__', isRoot: true, createBy: actor._id,
      file: [{ fileName: 'Villa contract.pdf', path: '/test/contract.pdf', entityType: 'Property', entityId: property._id,
        category: 'PROPERTIES', linkProperty: property._id, linkContact: contacts[0]._id, customFields: { reference: 'Contract reference A' } }] });
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    console.log('Launching browser for staged workspace');
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true, pipe: true, timeout: 60000 });
    page = await browser.newPage();
    const errors = [], measurements = [];
    page.on('pageerror', error => {
      const detail = { route: new URL(page.url()).pathname, message: error.message, stack: error.stack };
      errors.push(detail); console.log('PAGE ERROR:', JSON.stringify(detail));
    });
    await page.setRequestInterception(true);
    page.on('request', req => req.url().includes('/dashboard/exchange-rate')
      ? req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ rate: 34, source: 'Test fixture' }) }).catch(() => {})
      : req.continue().catch(() => {}));
    await page.evaluateOnNewDocument((user, token) => {
      localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('token', token);
      if (!localStorage.getItem('crm-language')) localStorage.setItem('crm-language', 'en');
      if (!localStorage.getItem('chakra-ui-color-mode')) localStorage.setItem('chakra-ui-color-mode', 'light');
    }, user, token);
    await page.setViewport({ width: 1440, height: 960 });
    for (let index = 0; index < (process.env.CRM_CHECK_LAYOUT_ONLY ? 0 : leads.length); index++) {
      const lead = leads[index], mode = index === 0 ? 'contact' : 'contactAndOpportunity';
      console.log('Checking lead action: ' + mode);
      await page.goto(origin + '/lead', { waitUntil: 'networkidle2' });
      await page.waitForFunction(name => [...document.querySelectorAll('.crm-record-row')].some(row => row.textContent.includes(name)), {}, lead.get('leadName'));
      const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/lead/convert/' + lead._id) && response.request().method() === 'POST');
      await page.evaluate((name, label) => {
        const row = [...document.querySelectorAll('.crm-record-row')].find(row => row.textContent.includes(name));
        const button = row.querySelector(`button[aria-label="${label}"]`); if (!button) throw new Error('Conversion button missing'); button.click();
      }, lead.get('leadName'), index === 0 ? 'Transfer to contacts' : 'Transfer to contacts and opportunities');
      const response = await responsePromise, result = await response.json();
      console.log('Transfer HTTP status: ' + response.status());
      assert.equal(response.status(), 200, JSON.stringify(result));
      const contact = await Contact.findById(result.contactId).lean();
      assert.equal(contact.deleted, false); assert.equal(contact.fullName, lead.get('leadName'));
      assert.equal(contact.convertedLeads[0].values.leadMessage, lead.get('leadMessage'));
      assert.equal(contact.customFields.reference, 'Original custom value ' + mode);
      assert.equal((await Lead.findById(lead._id)).deleted, true);
      if (result.opportunityId) {
        const opportunity = await Opportunity.findById(result.opportunityId).lean();
        assert.equal(String(opportunity.contact), result.contactId);
        assert.equal(opportunity.convertedLeads[0].values.leadMessage, lead.get('leadMessage'));
      }
      await page.goto(origin + '/contacts', { waitUntil: 'networkidle2' });
      console.log('Checking contacts list');
      await page.waitForSelector('.crm-data-table tbody tr');
      // Search through the actual list rather than assuming a pagination order.
      const search = await page.$('.crm-table-search input');
      await search.type(lead.get('leadName'));
      await page.waitForFunction(name => [...document.querySelectorAll('.crm-record-row')].some(row => row.textContent.includes(name)), {}, lead.get('leadName'));
      await page.goto(origin + '/contactView/' + result.contactId, { waitUntil: 'networkidle2' });
      console.log('Checking original source details');
      await page.waitForFunction(message => document.body.textContent.includes(message), {}, lead.get('leadMessage'));
      console.log('PASS: browser conversion ' + mode + ' persists and displays the contact and complete source data.');
    }
    const routes = ['/contacts', '/lead', '/properties', '/partner-customers', '/residences', '/opportunities', '/task',
      '/metting', '/phone-call', '/email', '/documents', '/invoices', '/email-template', '/calender', '/admin-setting', '/form-builder',
      '/default', '/reporting-analytics', '/user', '/audit-logs', '/data-visibility'];
    const checkedRoutes = process.env.CRM_CHECK_FOCUSED_ONLY ? [] : routes;
    for (const route of checkedRoutes) {
      console.log('Checking page: ' + route);
      await page.goto(origin + route, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.crm-content');
      await page.waitForSelector('#crm-page-help-slot .crm-page-help');
      const geometry = await page.evaluate(() => ({
        width: innerWidth, pageWidth: document.documentElement.scrollWidth,
        headerHeight: document.querySelector('.crm-header').getBoundingClientRect().height,
        contentTop: document.querySelector('.crm-content').getBoundingClientRect().top,
        sidebarWidth: document.querySelector('.crm-sidebar-shell').getBoundingClientRect().width,
        rowHeight: document.querySelector('.crm-record-row')?.getBoundingClientRect().height,
        fatal: /Something went wrong|Application error/.test(document.body.textContent),
      }));
      assert(geometry.pageWidth <= geometry.width + 1, route + ': page overflow ' + JSON.stringify(geometry));
      assert(geometry.headerHeight <= 52, route + ': oversized header');
      assert(!geometry.fatal, route + ': error boundary');
      if (route === '/contacts') assert(geometry.rowHeight <= 42, 'Contact rows remain too large: ' + geometry.rowHeight);
      measurements.push({ route, ...geometry });
      if (['/contacts', '/properties', '/documents', '/opportunities', '/default'].includes(route)) await page.screenshot({ path: path.join(artifacts, route.slice(1) + '-desktop.png') });
      if (route === '/documents') {
        const contrast = await page.$$eval('.crm-document-heading button', buttons => buttons.map(button => ({
          text: button.textContent.trim(), color: getComputedStyle(button).color, background: getComputedStyle(button).backgroundColor,
        })));
        for (const button of contrast) assert(button.color !== button.background, 'Unreadable document action: ' + button.text);
        const information = await page.$eval('.crm-document-information', element => element.textContent);
        for (const value of ['2. Information and category', 'Properties', 'Garden Villa', 'Customer 01', 'Contract reference A', 'Files without folder']) assert(information.includes(value), 'Missing document information: ' + value);
      }
    }
    if (process.env.CRM_CHECK_SIDEBAR) {
      await page.goto(origin + '/contacts', { waitUntil: 'networkidle2' });
      const destinations = await page.$$eval('.crm-sidebar-nav > a', links => links.map(link => link.getAttribute('href')));
      const expectedDestinations = ['/default', '/lead', '/contacts', '/properties', '/opportunities', '/partner-customers', '/residences',
        '/invoices', '/task', '/metting', '/phone-call', '/email', '/email-template', '/calender', '/documents', '/reporting-analytics', '/user'];
      assert.deepEqual(destinations, expectedDestinations, 'Sidebar destinations changed');
      const sidebarGeometry = async () => page.evaluate(() => {
        const rect = selector => {
          const { x, y, width, height, bottom, right } = document.querySelector(selector).getBoundingClientRect();
          return { x, y, width, height, bottom, right };
        };
        const logo = document.querySelector('.crm-sidebar-brand__logo img');
        const nav = document.querySelector('.crm-sidebar-nav');
        return { sidebar: rect('.crm-sidebar-shell'), brand: rect('.crm-sidebar-brand'), logo: rect('.crm-sidebar-brand__logo img'),
          nav: rect('.crm-sidebar-nav'), footer: rect('.crm-sidebar-footer'), imageLoaded: logo.complete && logo.naturalWidth > 0,
          imageFit: getComputedStyle(logo).objectFit, navScrollHeight: nav.scrollHeight, navHeight: nav.clientHeight,
          width: innerWidth, pageWidth: document.documentElement.scrollWidth, bodyOverflow: document.body.style.overflow,
          open: document.querySelector('.crm-shell').dataset.sidebarOpen };
      });
      let geometry = await sidebarGeometry();
      assert.equal(geometry.sidebar.width, 240); assert.equal(geometry.logo.width, 64);
      assert(geometry.imageLoaded); assert.equal(geometry.imageFit, 'contain');
      assert(geometry.logo.x >= geometry.brand.x && geometry.logo.right <= geometry.brand.right);
      assert(Math.abs(geometry.logo.x + geometry.logo.width / 2 - geometry.brand.x - geometry.brand.width / 2) < 1, 'Logo is not horizontally centered');
      assert(Math.abs(geometry.logo.y + geometry.logo.height / 2 - geometry.brand.y - geometry.brand.height / 2) < 1, 'Logo is not vertically centered');
      assert.equal(await page.$eval('.crm-sidebar-brand', brand => brand.textContent.trim()), '', 'Text remains beside the logo');
      assert(geometry.nav.bottom <= geometry.footer.y + 1); assert(geometry.footer.bottom <= 960);
      await page.screenshot({ path: path.join(artifacts, 'sidebar-expanded.png') });
      await page.click('.crm-sidebar-collapse');
      await page.waitForFunction(() => document.querySelector('.crm-sidebar-shell').getBoundingClientRect().width === 68);
      geometry = await sidebarGeometry(); assert.equal(geometry.logo.width, 48);
      assert.deepEqual(await page.$$eval('.crm-sidebar-nav > a', links => links.map(link => link.getAttribute('href'))), destinations);
      assert.equal(await page.$$eval('.crm-sidebar-link__label', labels => labels.length), 0);
      await page.screenshot({ path: path.join(artifacts, 'sidebar-collapsed.png') });
      await page.click('.crm-sidebar-collapse');
      await page.waitForFunction(() => document.querySelector('.crm-sidebar-shell').getBoundingClientRect().width === 240);
      await page.setViewport({ width: 1280, height: 720 });
      geometry = await sidebarGeometry(); assert(geometry.navScrollHeight > geometry.navHeight);
      assert(geometry.footer.bottom <= 720);
      await page.$eval('.crm-sidebar-nav', nav => { nav.scrollTop = nav.scrollHeight; });
      assert(await page.$eval('.crm-sidebar-nav', nav => nav.scrollTop > 0));
      const lastLink = await page.$eval('.crm-sidebar-nav > a:last-child', link => ({ bottom: link.getBoundingClientRect().bottom }));
      assert(lastLink.bottom <= geometry.footer.y + 1, 'Last navigation option cannot be reached');
      await page.screenshot({ path: path.join(artifacts, 'sidebar-short-screen.png') });
      for (const width of [390, 320]) {
        await page.setViewport({ width, height: width === 320 ? 568 : 844 });
        await page.goto(origin + '/contacts', { waitUntil: 'networkidle2' });
        assert.equal((await sidebarGeometry()).open, 'false');
        await page.click('.crm-sidebar-toggle');
        await page.waitForFunction(() => document.querySelector('.crm-sidebar-shell').getBoundingClientRect().x === 0);
        geometry = await sidebarGeometry();
        assert.equal(geometry.bodyOverflow, 'hidden'); assert(geometry.pageWidth <= width);
        assert(geometry.footer.bottom <= (width === 320 ? 568 : 844));
        assert(geometry.sidebar.width <= width - 48); assert.equal(geometry.logo.width, 64);
        await page.screenshot({ path: path.join(artifacts, 'sidebar-mobile-' + width + '.png') });
        await page.click('.crm-sidebar-mobile-close');
        await page.waitForFunction(() => document.querySelector('.crm-shell').dataset.sidebarOpen === 'false');
        assert.notEqual((await sidebarGeometry()).bodyOverflow, 'hidden');
        await page.click('.crm-sidebar-toggle'); await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('.crm-shell').dataset.sidebarOpen === 'false');
        await page.click('.crm-sidebar-toggle');
        await page.click('.crm-sidebar-nav > a[href="/lead"]');
        await page.waitForFunction(() => location.pathname === '/lead' && document.querySelector('.crm-shell').dataset.sidebarOpen === 'false');
        await page.click('.crm-sidebar-toggle');
        await page.waitForFunction(() => document.querySelector('.crm-sidebar-shell').getBoundingClientRect().x === 0);
        assert.equal(await page.$eval('.crm-sidebar-nav a[aria-current="page"]', link => link.getAttribute('href')), '/lead');
        await page.mouse.click(width - 15, 160);
        await page.waitForFunction(() => document.querySelector('.crm-shell').dataset.sidebarOpen === 'false');
      }
      console.log('PASS: sidebar branding, all destinations, collapsed rail, independent scroll, mobile close, Escape, backdrop and navigation.');
    }
    for (const language of process.env.CRM_CHECK_FOCUSED_ONLY ? [] : ['en', 'fa', 'tr']) {
      await page.evaluate(language => localStorage.setItem('crm-language', language), language);
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 900 });
        await page.goto(origin + '/contacts', { waitUntil: 'networkidle2' }); await page.waitForSelector('.crm-record-row');
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        assert(scrollWidth <= width + 1, language + '/' + width + ': page overflow');
        if (language === 'fa') await page.screenshot({ path: path.join(artifacts, 'contacts-fa-' + width + '.png') });
        if (process.env.CRM_CHECK_SIDEBAR && width === 390) {
          await page.click('.crm-sidebar-toggle');
          await page.waitForFunction(() => document.querySelector('.crm-sidebar-shell').getBoundingClientRect().x === 0);
          assert.equal(await page.$$eval('.crm-sidebar-nav > a', links => links.length), 17);
          await page.screenshot({ path: path.join(artifacts, 'sidebar-mobile-' + language + '.png') });
          await page.click('.crm-sidebar-mobile-close');
        }
      }
    }
    if (process.env.CRM_CHECK_DASHBOARD_TASKS) {
      const cases = [
        { width: 1440, language: 'fa', mode: 'light' }, { width: 768, language: 'fa', mode: 'light' },
        { width: 390, language: 'fa', mode: 'light' }, { width: 320, language: 'fa', mode: 'light' },
        { width: 1440, language: 'en', mode: 'dark' }, { width: 390, language: 'fa', mode: 'dark' },
        { width: 390, language: 'tr', mode: 'light' }, { width: 1440, language: 'en', mode: 'light' },
      ];
      if (process.env.CRM_CHECK_FOCUSED_ONLY) await page.goto(origin + '/default', { waitUntil: 'networkidle2' });
      for (const scenario of cases) {
        const label = scenario.width + '-' + scenario.language + '-' + scenario.mode;
        console.log('Checking dashboard and full task text: ' + label);
        await page.evaluate(({ language, mode }) => { localStorage.setItem('crm-language', language); localStorage.setItem('chakra-ui-color-mode', mode); }, scenario);
        await page.setViewport({ width: scenario.width, height: 900 });
        await page.goto(origin + '/default', { waitUntil: 'networkidle2' });
        await page.waitForSelector('.crm-dashboard-stats .crm-stat-card');
        await page.waitForFunction(() => document.querySelector('.crm-finance-kpi__count')?.textContent.trim() === '0');
        const dashboard = await page.evaluate(() => ({
          width: innerWidth, pageWidth: document.documentElement.scrollWidth,
          stats: document.querySelectorAll('.crm-dashboard-stats .crm-stat-card').length,
          statColumns: getComputedStyle(document.querySelector('.crm-dashboard-stats')).gridTemplateColumns.split(' ').length,
          panels: document.querySelectorAll('.crm-dashboard-panel').length,
          headers: [...document.querySelectorAll('.crm-dashboard-card-header')].map(header => ({ background: getComputedStyle(header).backgroundImage, shadow: getComputedStyle(header).boxShadow })),
          kpis: [...document.querySelectorAll('.crm-finance-kpi')].map(kpi => ({ background: getComputedStyle(kpi).backgroundImage, height: kpi.getBoundingClientRect().height })),
        }));
        assert(dashboard.pageWidth <= dashboard.width + 1, 'Dashboard page overflow: ' + label);
        assert.equal(dashboard.stats, 4); assert.equal(dashboard.panels, 6);
        if (scenario.width <= 767) assert.equal(dashboard.statColumns, 2, 'Mobile counters should use two compact columns');
        for (const header of dashboard.headers) { assert.equal(header.background, 'none'); assert.equal(header.shadow, 'none'); }
        for (const kpi of dashboard.kpis) { assert.equal(kpi.background, 'none'); assert(kpi.height < 180, 'Oversized sales tile'); }
        await page.screenshot({ path: path.join(artifacts, 'dashboard-' + label + '.png'), fullPage: true });
        await page.goto(origin + '/task', { waitUntil: 'networkidle2' });
        await page.waitForSelector('.crm-kanban-card__description');
        const fields = await page.$$eval('.crm-kanban-card__title, .crm-kanban-card__description, .crm-kanban-card__assignee, .crm-kanban-card__related', elements => elements.map(element => ({
          text: element.textContent, className: element.className, height: element.clientHeight, scrollHeight: element.scrollHeight,
          width: element.clientWidth, scrollWidth: element.scrollWidth, clamp: getComputedStyle(element).webkitLineClamp,
        })));
        for (const value of Object.values(longTask)) assert(fields.some(field => field.text === value), 'Task value missing: ' + value);
        for (const field of fields) {
          assert(field.scrollHeight <= field.height + 1, 'Task text is vertically clipped: ' + field.className + ' / ' + label);
          assert(field.scrollWidth <= field.width + 1, 'Task text is horizontally clipped: ' + field.className + ' / ' + label);
          assert.equal(field.clamp, 'none', 'Task text is still clamped');
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Task page overflow: ' + label);
        await page.screenshot({ path: path.join(artifacts, 'task-board-' + label + '.png'), fullPage: true });
        measurements.push({ type: 'dashboard-task', scenario, dashboard, taskFields: fields });
      }
      console.log('PASS: minimal dashboard, all six panels and four counters preserved; complete title, description, assignee and related name at 320/390/768/1440px in three languages and both themes.');
    }
    if (process.env.CRM_CHECK_DIALOG_CONTROLS) await require('./check-dialog-controls.cjs')({ page, browser, origin, artifacts, measurements });
    if (process.env.CRM_CHECK_SETTINGS) await require('./check-settings-workspace.cjs').check({ page, origin, artifacts, measurements, user });
    await page.evaluate(() => { localStorage.setItem('chakra-ui-color-mode', 'dark'); localStorage.setItem('crm-language', 'en'); });
    await page.setViewport({ width: 1440, height: 960 });
    await page.goto(origin + '/documents', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.crm-document-information');
    await page.screenshot({ path: path.join(artifacts, 'documents-dark.png') });
    assert.deepEqual(errors, [], 'Browser runtime errors');
    fs.writeFileSync(path.join(artifacts, 'measurements.json'), JSON.stringify(measurements, null, 2));
    console.log('PASS: ' + checkedRoutes.length + ' general CRM pages plus the requested focused checks; no browser runtime errors.');
  } catch (error) {
    if (page) {
      console.log('Browser diagnostic:', JSON.stringify(await page.evaluate(() => ({ path: location.pathname, text: document.body.innerText.slice(-3500) })).catch(() => ({}))));
      await page.screenshot({ path: path.join(artifacts, 'browser-failure.png') }).catch(() => {});
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName); assert(dbName.startsWith('crm_compact_browser_test_'));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
