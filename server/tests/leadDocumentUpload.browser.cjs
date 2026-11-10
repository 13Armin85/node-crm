const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const puppeteer = require('puppeteer');

test('lead documents upload, download and delete across open views, including deletion of folders and their contents', {
  skip: process.env.LEAD_UPLOAD_BROWSER !== '1', timeout: 180000,
}, async t => {
  const dbName = 'crm_lead_upload_browser_' + crypto.randomUUID().replace(/-/g, '');
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  let server, browser;
  const uploaded = [];
  t.after(async () => {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    const root = path.resolve(__dirname, '../uploads/document') + path.sep;
    for (const filename of uploaded) { assert(filename.startsWith(root)); await fs.unlink(filename).catch(() => {}); }
    assert.equal(mongoose.connection.name, dbName); assert(dbName.startsWith('crm_lead_upload_browser_'));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  });
  const app = express(); app.use(express.json());
  const { securityHeaders, errorHandler } = require('../middelwares/securityHeaders');
  app.use('/api', securityHeaders, require('../controllers/route')); app.use(errorHandler);
  const release = path.resolve(process.env.CRM_TEST_RELEASE || path.join(__dirname, '../../client/build'));
  await fs.access(path.join(release, 'asset-manifest.json'));
  app.use(express.static(release)); app.get('*', (req, res) => res.sendFile(path.join(release, 'index.html')));
  const User = require('../model/schema/user'), Document = require('../model/schema/document');
  const CustomField = require('../model/schema/customField');
  const { Lead, initializeLeadSchema } = require('../model/schema/lead');
  await CustomField.create({ moduleName: 'Leads', fields: require('../db/leadFields').leadFields });
  await initializeLeadSchema();
  await require('../model/schema/formDefinition').create({ moduleName: 'Documents', fields: [
    { name: 'folderName', kind: 'SYSTEM_FIELD', type: 'text', required: true, enabled: true, label: { en: 'Folder Name', fa: 'نام پوشه', tr: 'Klasör adı' } },
  ] });
  const creator = await User.create({ username: 'admin@example.test', password: 'unused', role: 'admin' });
  const actor = await User.create({ username: 'assigned@example.test', firstName: 'Assigned', lastName: 'Agent', password: 'unused', role: 'user' });
  const lead = await Lead.create({ leadName: 'Upload Test Lead', createBy: creator._id, assignUser: actor._id });
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const token = jwt.sign({ userId: actor._id }, require('../config/auth').jwtSecret, { expiresIn: '5m' });
  const artifacts = path.resolve(__dirname, '../../layout-artifacts/lead-upload-browser', dbName);
  await fs.mkdir(artifacts, { recursive: true });
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true,
    args: ['--no-sandbox', '--disable-gpu'], userDataDir: path.join(artifacts, 'profile') });
  const page = await browser.newPage(); await page.setViewport({ width: 390, height: 950 });
  const errors = [], failedApi = []; page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 400) failedApi.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  await (await page.createCDPSession()).send('Browser.setDownloadBehavior', { behavior: 'deny' });
  await page.goto(origin + '/auth', { waitUntil: 'networkidle2' });
  await page.evaluate((actor, token) => {
    localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(actor)); localStorage.setItem('crm-language', 'fa');
  }, { _id: String(actor._id), role: actor.role, firstName: actor.firstName }, token);
  await page.goto(origin + '/leadView/' + lead._id, { waitUntil: 'networkidle2' });
  try { await page.waitForSelector('.crm-record-documents button'); }
  catch (error) { console.log(JSON.stringify({ browserErrors: errors, failedApi, url: page.url(), content: await page.$eval('body', node => node.textContent.slice(-1400)) })); throw error; }
  await page.click('.crm-record-documents button');
  await page.waitForSelector('[role="dialog"] input[type="file"]');
  const contents = 'Real lead upload ' + crypto.randomUUID();
  const filename = path.join(artifacts, 'lead-upload.txt'); await fs.writeFile(filename, contents);
  await (await page.$('[role="dialog"] input[type="file"]')).uploadFile(filename);
  await page.waitForFunction(() => document.querySelector('[role="dialog"] .dropzone')?.textContent.includes('1'));
  const response = page.waitForResponse(response => response.url().endsWith('/api/document/add') && response.request().method() === 'POST', { timeout: 15000 });
  await page.$$eval('[role="dialog"] .chakra-modal__footer button', nodes => nodes[0].click());
  const posted = await response, result = await posted.json();
  if (result.folder) {
    const folder = await Document.findById(result.folder._id).lean(); uploaded.push(...folder.file.map(file => file.path));
  }
  assert.equal(posted.status(), 200, JSON.stringify({ code: result.code, field: result.field }));
  assert.equal(result.folder.isRoot, true); assert.equal(result.folder.createBy, String(actor._id));
  const file = result.folder.file.at(-1);
  assert.equal(file.linkLead, String(lead._id)); assert.equal(file.category, 'LEADS');
  assert(file.relatedRecords.some(record => record.label === 'Upload Test Lead'));
  const selector = `.crm-document-card[data-document-id="${file._id}"]`;
  await page.waitForSelector('.crm-record-documents ' + selector);
  assert((await page.$eval(selector, node => node.textContent)).includes('Upload Test Lead'));
  const download = page.waitForResponse(response => response.url().endsWith('/api/document/download/' + file._id));
  await page.click(selector + ' button');
  const downloaded = await download;
  assert.equal(downloaded.status(), 200); assert.equal((await downloaded.buffer()).toString(), contents);
  console.log('PASS: lead upload and exact download bytes');
  await page.goto(origin + '/documents?file=' + file._id, { waitUntil: 'networkidle2' });
  await page.waitForSelector(selector);
  assert((await page.$eval(selector, node => node.textContent)).includes('Upload Test Lead'));
  const center = await browser.newPage();
  center.on('pageerror', error => errors.push(error.message));
  await center.goto(origin + '/documents?file=' + file._id, { waitUntil: 'networkidle2' });
  await center.waitForSelector(selector);
  await page.bringToFront();
  await page.goto(origin + '/leadView/' + lead._id, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.crm-record-documents ' + selector);
  assert.equal(await page.$$('.crm-record-documents ' + selector + ' button').then(nodes => nodes.length), 2);
  page.once('dialog', dialog => dialog.accept());
  let removed = page.waitForResponse(response => response.request().method() === 'DELETE' && response.url().endsWith('/api/document/delete/' + file._id));
  await page.click('.crm-record-documents ' + selector + ' button:last-child');
  assert.equal((await removed).status(), 200);
  await page.waitForFunction(selector => !document.querySelector(selector), { polling: 100 }, selector);
  await center.waitForFunction(selector => !document.querySelector(selector), { polling: 100 }, selector);
  console.log('PASS: deletion from the lead page refreshes an already open document tab');
  assert.equal((await fetch(origin + '/api/document/download/' + file._id, { headers: { Authorization: token } })).status, 404);

  const original = (await Document.findById(result.folder._id).lean()).file.at(-1);
  const nestedId = new mongoose.Types.ObjectId();
  const parent = await Document.create({ folderName: 'Delete browser folder', createBy: actor._id, file: [] });
  const child = await Document.create({ folderName: 'Delete browser child', parentFolder: parent._id, createBy: actor._id,
    file: [{ ...original, _id: nestedId, deleted: false }] });
  const nestedSelector = `.crm-document-card[data-document-id="${nestedId}"]`;
  await page.goto(origin + '/leadView/' + lead._id, { waitUntil: 'networkidle2' });
  await page.waitForSelector(nestedSelector);
  await center.bringToFront();
  await center.goto(origin + '/documents?folder=' + parent._id, { waitUntil: 'networkidle2' });
  await center.waitForSelector('button[aria-label="حذف پوشه"]');
  center.once('dialog', dialog => dialog.accept());
  removed = center.waitForResponse(response => response.request().method() === 'DELETE' && response.url().endsWith('/api/document/delete/folder/' + parent._id));
  await center.click('button[aria-label="حذف پوشه"]');
  assert.equal((await removed).status(), 200);
  await page.waitForFunction(selector => !document.querySelector(selector), { polling: 100 }, nestedSelector);
  assert.equal((await Document.findById(parent._id)).deleted, true);
  assert.equal((await Document.findById(child._id)).deleted, true);
  assert.deepEqual(errors, []);
  console.log('PASS: upload, exact download, deletion from lead view, folder tree deletion and synchronization across open browser tabs');
});
