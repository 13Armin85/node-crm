const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const mongoose = require('../server/node_modules/mongoose');
const express = require('../server/node_modules/express');
const jwt = require('../server/node_modules/jsonwebtoken');
const puppeteer = require('../server/node_modules/puppeteer');
const ExcelJS = require('../client/node_modules/exceljs');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'layout-artifacts/table-tools');
const dbName = 'crm_import_ui_test_' + crypto.randomUUID().replace(/-/g, '');
async function main() {
  fs.mkdirSync(artifacts, { recursive: true });
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  mongoose.set('strictQuery', false);
  let browser, server;
  try {
    const app = express(); app.use(express.json({ limit: '2mb' })); app.use('/api', require('../server/controllers/route'));
    app.use(require('../server/middelwares/securityHeaders').errorHandler);
    const build = path.resolve(process.env.CRM_BUILD_ROOT || path.join(root, 'layout-artifacts/table-tools-build'));
    assert(fs.existsSync(path.join(build, 'index.html')), 'Client build missing');
    app.use(express.static(build)); app.get('*', (_, res) => res.sendFile(path.join(build, 'index.html')));
    const User = require('../server/model/schema/user');
    const { Contact } = require('../server/model/schema/contact');
    Contact.schema.add({ fullName: String, email: String, phoneNumber: String });
    const { Lead } = require('../server/model/schema/lead'); Lead.schema.add({ leadName: String, leadEmail: String, leadMobile: String });
    const user = await User.create({ username: 'ui-import@example.test', role: 'admin', firstName: 'Import', lastName: 'Test', password: 'test-only' });
    await require('../server/model/schema/customField').create({ moduleName: 'Contacts', fields: [
      { name: 'fullName', label: 'Full Name', backendType: 'String', fixed: true, isTableField: true, isView: true },
      { name: 'email', label: 'Email', backendType: 'String', type: 'email', fixed: true, isTableField: true },
      { name: 'phoneNumber', label: 'Phone Number', backendType: 'String', type: 'tel', fixed: true, isTableField: true },
    ] });
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(origin + '/auth', { waitUntil: 'networkidle0' });
    const token = jwt.sign({ userId: user._id }, require('../server/config/auth').jwtSecret, { expiresIn: '15m' });
    await page.evaluate((user, token) => { localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('token', token); localStorage.setItem('crm-language', 'en'); }, user.toObject(), token);
    const goto = async route => { await page.goto(origin + route, { waitUntil: 'networkidle0' }); await page.waitForSelector('.crm-table-settings'); };
    const clickText = async (selector, label) => page.$$eval(selector, (nodes, text) => { const node = nodes.find(node => node.textContent.trim() === text); if (!node) throw new Error('Missing control: ' + text); node.click(); }, label);
    const menu = async label => { await page.waitForFunction(() => !document.querySelector('[role="dialog"]')); await page.click('.crm-table-settings'); await page.waitForSelector('.crm-table-tools-menu', { visible: true }); await clickText('.crm-table-tools-menu [role="menuitem"]', label); };
    const closeModal = async () => { await page.click('[role="dialog"] .chakra-modal__close-btn'); await page.waitForFunction(() => !document.querySelector('[role="dialog"]')); };
    const upload = async file => { await menu('Import'); await page.waitForSelector('#record-import-file'); await (await page.$('#record-import-file')).uploadFile(file); await page.waitForSelector('.crm-import-preview'); };
    const importButton = '.crm-import-modal .chakra-modal__footer button:first-child';
    const sendImport = async expected => {
      await page.waitForFunction(selector => !document.querySelector(selector)?.disabled, {}, importButton);
      const responsePromise = page.waitForResponse(response => response.url().includes('/api/import/') && response.request().method() === 'POST');
      await page.click(importButton); const response = await responsePromise, data = await response.json();
      assert.equal(response.status(), expected, JSON.stringify(data)); return data;
    };
    await goto('/contacts');
    const headerCount = await page.$$eval('table thead th', nodes => nodes.length);
    await menu('Manage Columns'); await page.waitForSelector('.crm-columns-modal input[type="checkbox"]');
    await page.click('.crm-columns-modal label'); await clickText('.crm-columns-modal button', 'Cancel');
    assert.equal(await page.$$eval('table thead th', nodes => nodes.length), headerCount, 'Cancel must preserve column selection');
    await menu('Manage Columns'); await page.waitForSelector('.crm-columns-modal input[type="checkbox"]');
    await page.click('.crm-columns-modal label'); await clickText('.crm-columns-modal button', 'Save');
    await page.waitForFunction(count => document.querySelectorAll('table thead th').length === count - 1, {}, headerCount);
    await menu('Manage Columns'); await page.waitForSelector('.crm-columns-modal input[type="checkbox"]');
    await page.click('.crm-columns-modal label'); await clickText('.crm-columns-modal button', 'Save');
    console.log('PASS shared columns: hide, save, cancel and restore');
    const csvFile = path.join(artifacts, 'contacts.csv');
    fs.writeFileSync(csvFile, '\ufeffFull Name,Email,Phone Number\nBrowser Person One,person-one@example.test,+90 555 100 1001\nBrowser Person Two,person-two@example.test,+90 555 100 1002\n');
    await upload(csvFile);
    assert.equal(await page.$eval('#import-map-fullName', input => input.value), 'Full Name');
    assert.equal((await sendImport(201)).imported, 2);
    await page.waitForFunction(() => !document.querySelector('.crm-import-modal'));
    await page.waitForFunction(() => document.querySelector('table tbody')?.textContent.includes('Browser Person Two'));
    assert.equal(await Contact.countDocuments({}), 2);
    console.log('PASS actual CSV: automatic mapping, persisted contacts and list refresh');
    await upload(csvFile); await sendImport(400);
    await page.waitForFunction(() => document.querySelector('.crm-import-modal [role="alert"]')?.textContent.includes('2'));
    assert.equal(await Contact.countDocuments({}), 2); await closeModal();
    console.log('PASS duplicate CSV: row errors shown, dialog remains open and no extra records');
    const invalidFile = path.join(artifacts, 'invalid.csv'); fs.writeFileSync(invalidFile, 'Full Name,Email,Phone Number\nMissing Email,,+90 555 111 1111\n');
    await upload(invalidFile);
    await page.waitForFunction(selector => document.querySelector(selector)?.disabled, {}, importButton);
    assert(await page.$('#import-map-email[aria-invalid="true"]'), 'Required column must be highlighted'); await closeModal();
    console.log('PASS missing required field: highlighted mapping and disabled submission');
    const leadFile = path.join(artifacts, 'leads.csv'); fs.writeFileSync(leadFile, 'leadName,leadEmail,leadMobile\nBrowser Lead,lead-ui@example.test,+90 555 111 2222\n');
    await goto('/lead'); await upload(leadFile); await page.click('#import-default-contact');
    await page.waitForSelector('#import-default-contact-options [role="option"]', { visible: true });
    assert(!(await page.$eval('#import-default-contact-options', node => node.textContent)).includes('[object'), 'Relation labels must be plain text');
    await page.click('#import-default-contact-options [role="option"]'); await sendImport(201);
    await page.waitForFunction(() => !document.querySelector('.crm-import-modal'));
    const importedLead = await Lead.findOne({}).lean(); assert(importedLead.contact, 'Selected default relation must persist');
    assert((await Contact.findById(importedLead.contact).lean()).relatedLeads.some(id => String(id) === String(importedLead._id)));
    console.log('PASS lead CSV: searchable default relationship, imported fields and reverse link');
    const excelFile = path.join(artifacts, 'residences.xlsx'), workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet('Residences');
    sheet.addRow(['name', 'city', 'maintenanceFee.amount', 'maintenanceFee.currency']);
    sheet.addRow(['Browser Residence One', 'Istanbul', 0, 'USD']); sheet.addRow(['Browser Residence Two', 'Ankara', 10.5, 'EUR']); await workbook.xlsx.writeFile(excelFile);
    await goto('/residences'); await upload(excelFile); assert.equal((await sendImport(201)).imported, 2);
    await page.waitForFunction(() => !document.querySelector('.crm-import-modal'));
    await page.waitForFunction(() => document.querySelector('table tbody')?.textContent.includes('Browser Residence Two'));
    const residences = await require('../server/model/schema/residence').find({}).sort({ name: 1 }).lean();
    assert.deepEqual(residences.map(row => row.maintenanceFee.amount), [0, 10.5]);
    console.log('PASS actual XLSX: nested values, zero and decimals preserved with list refresh');
    const visibleHeaders = () => page.$$eval('table thead th', nodes => nodes.filter(node => getComputedStyle(node).display !== 'none').length);
    const entityCount = await visibleHeaders();
    await menu('Manage Columns'); await page.waitForSelector('.crm-columns-modal input[type="checkbox"]');
    await page.click('.crm-columns-modal label'); await clickText('.crm-columns-modal button', 'Save');
    await page.waitForFunction(count => [...document.querySelectorAll('table thead th')].filter(node => getComputedStyle(node).display !== 'none').length === count - 1, {}, entityCount);
    assert.equal(await page.$$eval('table tbody tr:first-child td', nodes => nodes.filter(node => getComputedStyle(node).display !== 'none').length), entityCount - 1, 'Body columns must match headers');
    await menu('Manage Columns'); await page.waitForSelector('.crm-columns-modal input[type="checkbox"]');
    await page.click('.crm-columns-modal label'); await clickText('.crm-columns-modal button', 'Save');
    console.log('PASS entity columns: header and cell visibility stay aligned');
    for (const route of ['/properties', '/residences', '/partner-customers', '/contacts', '/lead', '/opportunities', '/invoices', '/user', '/metting', '/phone-call', '/email']) {
      await goto(route); await page.click('.crm-table-settings'); await page.waitForSelector('.crm-table-tools-menu');
      assert((await page.$eval('.crm-table-tools-menu', node => node.textContent)).includes('Manage Columns'), route);
      await page.keyboard.press('Escape'); console.log('PASS consistent tools ' + route);
    }
    await page.goto(origin + '/task', { waitUntil: 'networkidle0' }); await clickText('button', 'List'); await page.waitForSelector('.crm-table-settings');
    await menu('Manage Columns'); await page.waitForSelector('.crm-columns-modal'); await closeModal();
    console.log('PASS task list shared tools');
    for (const [language, mode, width, route, label] of [['fa', 'light', 1440, '/contacts', 'مدیریت ستون‌ها'], ['fa', 'dark', 390, '/residences', 'مدیریت ستون‌ها'], ['en', 'dark', 1440, '/partner-customers', 'Manage Columns']]) {
      await page.setViewport({ width, height: 1000 });
      await page.evaluate((language, mode) => { localStorage.setItem('crm-language', language); localStorage.setItem('chakra-ui-color-mode', mode); }, language, mode);
      await goto(route); await page.click('.crm-table-settings'); await page.waitForSelector('.crm-table-tools-menu');
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.crm-table-tools-menu')).opacity) >= 0.99);
      const rect = await page.$eval('.crm-table-tools-menu', node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, width: innerWidth }; });
      assert(rect.left >= 0 && rect.right <= rect.width + 1, 'Menu must stay in viewport');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page overflow');
      await page.screenshot({ path: path.join(artifacts, `${language}-${mode}-${width}.png`) }); await page.keyboard.press('Escape');
      console.log('PASS theme/layout ' + language + '/' + mode + '/' + width);
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
  } catch (error) {
    if (browser) { const pages = await browser.pages(); const page = pages.at(-1); await page.screenshot({ path: path.join(artifacts, 'failure.png') }); fs.writeFileSync(path.join(artifacts, 'failure.txt'), await page.evaluate(() => document.body.innerText)); }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName); assert(dbName.startsWith('crm_import_ui_test_'));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
