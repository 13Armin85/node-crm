const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
let fixture;
exports.seed = async ({ actor, contacts, User }) => {
  const colleague = await User.create({ username: 'notes-colleague@example.test', firstName: 'Nora', lastName: 'Advisor', jobTitle: 'Sales consultant', role: 'user', password: 'unused-test-only' });
  const Note = require('../server/model/schema/recordNote');
  await Note.create({ module: 'Contacts', record: contacts[0]._id, author: colleague._id, authorName: 'Nora Advisor', text: 'Customer requested a garden apartment.', clientId: 'browser-seed' });
  const task = await require('../server/model/schema/task').create({ title: 'Arrange property viewing', category: 'Contact', assignTo: contacts[0]._id, assignedToUser: actor._id, createBy: actor._id, start: '2026-11-05', end: '2026-11-06' });
  const call = await require('../server/model/schema/phoneCall').create({ sender: actor._id, recipient: 'Customer 01', callNotes: 'Call original notes', createByContact: contacts[0]._id, createBy: actor._id });
  const email = await require('../server/model/schema/email').create({ sender: actor._id, recipient: 'customer1@example.test', subject: 'Viewing confirmation', message: 'Original email body', createByContact: contacts[0]._id, createBy: actor._id });
  const meeting = await require('../server/model/schema/meeting').create({ agenda: 'Garden apartment visit', attendes: [contacts[0]._id], dateTime: '2026-11-05T11:00:00.000Z', createBy: actor._id });
  const invoice = await require('../server/model/schema/invoices').create({ title: 'Garden invoice', invoiceNumber: 'INV-001', createBy: actor._id, modifiedBy: actor._id, contact: contacts[0]._id, currency: 'TRY', items: [] });
  const template = await require('../server/model/schema/emailTemplate').create({ templateName: 'Viewing template', description: 'Message template', html: '<p>Viewing confirmation</p>', createBy: actor._id });
  const metadata = await require('../server/model/schema/customField').create({ moduleName: 'Follow Up Records', fields: [{ name: 'title', label: 'Title', type: 'text', backendType: 'String' }, { name: 'notes', label: 'Notes', type: 'textarea', backendType: 'String' }] });
  const custom = await require('../server/controllers/form/form').getModel(metadata).create({ title: 'Custom viewing record', notes: 'Full custom details', createBy: actor._id });
  fixture = { colleague, task, call, email, meeting, invoice, template, custom, actorId: actor._id };
};
exports.cleanup = async () => {
  const user = await require('../server/model/schema/user').findById(fixture?.actorId).select('avatarFilename').lean();
  if (!user?.avatarFilename) return;
  const root = path.resolve(__dirname, '../server/uploads/profile');
  const filename = path.resolve(root, user.avatarFilename);
  assert.equal(path.dirname(filename), root);
  await fs.promises.unlink(filename).catch(() => {});
};
exports.check = async ({ page, origin, artifacts, measurements, contacts, leads, property, user }) => {
  const go = async route => { console.log('Record browser check:', route); await page.goto(origin + route, { waitUntil: 'networkidle2' }); };
  const fill = async (selector, value) => {
    await page.focus(selector); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
    await page.keyboard.press('Backspace'); await page.type(selector, value);
    assert.equal(await page.$eval(selector, input => input.value), value, 'Edited input did not retain its value: ' + selector);
  };
  const button = async (selector, text) => {
    await page.waitForFunction((selector, text) => [...document.querySelectorAll(selector)].some(el => el.textContent.trim() === text), {}, selector, text);
    await page.$$eval(selector, (elements, text) => elements.find(element => element.textContent.trim() === text).click(), text);
  };
  const noOverflow = async label => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    // The shell animates its desktop margin when crossing the mobile breakpoint.
    // Check the settled layout after that transition rather than its intermediate width.
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 2, { timeout: 3000 }).catch(() => {});
    const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    if (size.scroll > size.width + 1) console.log('Overflow elements', await page.$$eval('.crm-content *', elements => elements.filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(-25).map(el => ({ tag: el.tagName, cls: el.className, text: el.textContent.slice(0,70), width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right, minWidth: getComputedStyle(el).minWidth, display: getComputedStyle(el).display, columns: getComputedStyle(el).gridTemplateColumns }))));
    assert(size.scroll <= size.width + 2, label + ' overflow ' + JSON.stringify(size)); measurements.push({ label, ...size });
  };
  if (process.env.CRM_RECORD_LAYOUT_ONLY) {
    for (const route of ['/metting/' + fixture.meeting._id, '/phone-call/' + fixture.call._id, '/Email/' + fixture.email._id, '/userView/' + user._id]) {
      await page.setViewport({ width: 320, height: 740 }); await go(route); await noOverflow(route);
    }
    await go('/metting/' + fixture.meeting._id); await page.waitForSelector('.crm-detail-legacy #reports');
    await page.select('.crm-language-select select', 'fa');
    await page.waitForFunction(() => document.documentElement.lang === 'fa' && /ثانیه|دقیقه/.test(document.querySelector('.crm-detail-legacy')?.textContent));
    await page.select('.crm-language-select select', 'tr');
    await page.waitForFunction(() => document.documentElement.lang === 'tr' && /saniye|dakika/.test(document.querySelector('.crm-detail-legacy')?.textContent));
    console.log('PASS: final compiled responsive views and instant date translations in Persian and Turkish.');
    return;
  }
  const contactPath = '/contactView/' + contacts[0]._id;
  await go(contactPath); await page.waitForSelector('.crm-note');
  assert.equal(await page.$eval('.crm-note-meta a', el => el.textContent), 'Nora Advisor');
  assert(await page.$eval('.crm-note-meta time', el => !!el.dateTime && !!el.textContent));
  assert.equal(await page.$eval('.crm-note-meta a', el => el.getAttribute('href')), '/profile/' + fixture.colleague._id);
  const order = await page.evaluate(() => [...document.querySelectorAll('.crm-contact-section')].map(el => ({ id: el.id, top: el.getBoundingClientRect().top, display: getComputedStyle(el).display })));
  assert(order.length >= 3); assert(order.every(el => el.display !== 'none')); assert(order[1].top > order[0].top);
  await button('.crm-detail-heading-actions button', 'Edit details'); await page.waitForSelector('#detail-edit-fullName');
  await fill('#detail-edit-fullName', 'Customer Updated');
  const savedContact = page.waitForResponse(r => r.url().includes('/api/form/edit/') && r.request().method() === 'PUT');
  await button('.crm-inline-editor-actions button', 'Save'); assert.equal((await savedContact).status(), 200);
  await page.waitForFunction(() => !document.querySelector('.crm-inline-record-editor'));
  await go(contactPath); assert(await page.$eval('.crm-detail-heading', el => el.textContent.includes('Customer Updated')));
  const noteText = ('Complete shared follow-up\n' + 'All details remain visible. '.repeat(15)).trim();
  await fill('.crm-note-composer textarea', noteText); await page.click('.crm-note-composer button[type=submit]');
  await page.waitForFunction(text => [...document.querySelectorAll('.crm-note-text')].some(el => el.textContent === text), {}, noteText);
  assert(await page.$eval('.crm-note--mine .crm-note-meta a', el => el.textContent.includes('Workspace Reviewer')));
  await page.screenshot({ path: path.join(artifacts, 'contact-details-notes-desktop.png'), fullPage: true });
  await page.click('.crm-note-meta a'); await page.waitForSelector('.crm-profile-page');
  await page.waitForSelector('.crm-profile-layout');
  assert.equal(await page.$$('.crm-profile-page input').then(el => el.length), 0);
  assert(await page.$eval('.crm-profile-page', el => el.textContent.includes('Sales consultant')));
  await go('/profile'); await page.waitForSelector('#profile-firstName'); await fill('#profile-jobTitle', 'Property Advisor'); await fill('#profile-bio', 'Full profile biography\nSecond line');
  const savedProfile = page.waitForResponse(r => r.url().endsWith('/api/profile/me') && r.request().method() === 'PUT');
  await page.click('.crm-profile-page button[type=submit]'); assert.equal((await savedProfile).status(), 200);
  const photo = path.join(artifacts, 'profile-fixture.png'); fs.writeFileSync(photo, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64'));
  const uploaded = page.waitForResponse(r => r.url().endsWith('/api/profile/me/avatar') && r.request().method() === 'POST');
  await (await page.$('#profile-photo')).uploadFile(photo); assert.equal((await uploaded).status(), 200);
  await page.waitForSelector('.crm-profile-summary img');
  await go('/profile'); await page.waitForFunction(() => document.querySelector('#profile-jobTitle')?.value === 'Property Advisor');
  await go('/contacts'); await page.waitForSelector('.crm-contact-name-cell .crm-contact-transfer');
  await page.type('.crm-table-search input', 'Customer Updated');
  await page.waitForFunction(() => [...document.querySelectorAll('.crm-contact-name-cell')].some(el => el.textContent.includes('Customer Updated')));
  await page.evaluate(() => [...document.querySelectorAll('.crm-contact-name-cell')].find(el => el.textContent.includes('Customer Updated')).querySelector('button').click());
  await page.waitForFunction(() => location.pathname.startsWith('/opportunitiesView/'));
  const opportunityPath = new URL(page.url()).pathname;
  await page.waitForFunction(text => [...document.querySelectorAll('.crm-note-text')].some(el => el.textContent === text), {}, noteText);
  assert(await page.$eval('.crm-record-workspace', el => el.textContent.includes('Customer Updated')));
  const infoTop = await page.$eval('.crm-record-information', el => el.getBoundingClientRect().bottom);
  const relatedTop = await page.$eval('.crm-related-grid', el => el.getBoundingClientRect().top); assert(relatedTop > infoTop);
  await button('.crm-detail-heading-actions button', 'Edit details'); await page.waitForSelector('#detail-edit-opportunityName');
  await fill('#detail-edit-opportunityName', 'Garden opportunity'); const savedOpportunity = page.waitForResponse(r => r.url().includes('/api/opportunity/edit/') && r.request().method() === 'PUT');
  await button('.crm-inline-editor-actions button', 'Save'); assert.equal((await savedOpportunity).status(), 200);
  await go(opportunityPath); await page.waitForFunction(() => document.querySelector('.crm-detail-heading')?.textContent.includes('Garden opportunity'));
  await button('.crm-opportunity-detail-toolbar button', 'Edit'); await page.waitForSelector('[role=dialog]'); await page.keyboard.press('Escape');
  const paths = [contactPath, opportunityPath, '/leadView/' + leads[0]._id, '/propertyView/' + property._id, '/view/' + fixture.task._id, '/metting/' + fixture.meeting._id, '/phone-call/' + fixture.call._id, '/Email/' + fixture.email._id, '/userView/' + user._id, '/profile'];
  for (const [route, field, value] of [
    ['/view/' + fixture.task._id, 'title', 'Updated viewing task'],
    ['/metting/' + fixture.meeting._id, 'agenda', 'Updated viewing meeting'],
    ['/phone-call/' + fixture.call._id, 'callNotes', 'Updated call details'],
    ['/Email/' + fixture.email._id, 'subject', 'Updated viewing email'],
    ['/follow-up-records/' + fixture.custom._id, 'title', 'Updated custom record'],
  ]) {
    await go(route); await button('.crm-detail-heading-actions button', 'Edit details');
    await page.waitForSelector('#detail-edit-' + field); await fill('#detail-edit-' + field, value);
    const saved = page.waitForResponse(r => r.url().includes('/api/') && r.request().method() === 'PUT');
    await button('.crm-inline-editor-actions button', 'Save'); const response = await saved; assert.equal(response.status(), 200, route + ': ' + await response.text());
    await page.waitForFunction(() => !document.querySelector('.crm-inline-record-editor'));
  }
  paths.push('/invoicesView/' + fixture.invoice._id, '/email-template/' + fixture.template._id, '/follow-up-records/' + fixture.custom._id);
  for (const route of paths) {
    await page.setViewport({ width: 1440, height: 960 }); await go(route); await page.waitForSelector('.crm-record-workspace, .crm-profile-page'); await noOverflow(route + '/desktop');
    await page.setViewport({ width: 320, height: 740 }); await noOverflow(route + '/mobile');
  }
  for (const language of ['en', 'fa', 'tr']) {
    await page.evaluate(language => localStorage.setItem('crm-language', language), language);
    for (const route of [contactPath, opportunityPath, '/profile']) {
      await go(route); await page.waitForSelector('.crm-record-workspace, .crm-profile-page'); await noOverflow(language + route);
      assert(!await page.$eval('.crm-content', el => /notes\.(title|send)|profile\.(title|information)|details\.edit/.test(el.textContent)), 'Translation key visible');
      await page.screenshot({ path: path.join(artifacts, (route === contactPath ? 'contact' : route === opportunityPath ? 'opportunity' : 'profile') + '-mobile-' + language + '.png'), fullPage: true });
    }
  }
  await page.evaluate(() => localStorage.setItem('chakra-ui-color-mode', 'dark')); await page.setViewport({ width: 1440, height: 960 }); await go(opportunityPath);
  await page.screenshot({ path: path.join(artifacts, 'opportunity-dark.png'), fullPage: true }); await noOverflow('opportunity dark');
  const colleagueToken = require('../server/node_modules/jsonwebtoken').sign({ userId: fixture.colleague._id }, require('../server/config/auth').jwtSecret, { expiresIn: '5m' });
  const userScript = await page.evaluateOnNewDocument((user, token) => { localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('token', token); localStorage.setItem('crm-language', 'en'); }, { _id: String(fixture.colleague._id), firstName: 'Nora', lastName: 'Advisor', role: 'user' }, colleagueToken);
  await go('/profile'); await page.waitForFunction(() => document.querySelector('#profile-firstName')?.value === 'Nora');
  await noOverflow('ordinary user profile'); await page.removeScriptToEvaluateOnNewDocument(userScript.identifier);
  console.log('PASS: editable detail pages, full contact transfer, multi-author persistent chat, profile/photo, all three languages and responsive details.');
};

