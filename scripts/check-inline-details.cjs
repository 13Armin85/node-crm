const assert = require('node:assert/strict');
const path = require('node:path');
let fixture;
exports.seed = async ({ actor, contacts, property }) => {
  const { defaults } = require('../server/services/formDefinitions');
  const FormDefinition = require('../server/model/schema/formDefinition');
  const custom = { name: 'inlineReference', kind: 'CUSTOM_FIELD', type: 'text', enabled: true, label: { en: 'Reference', fa: 'Ù…Ø±Ø¬Ø¹', tr: 'Referans' } };
  const orderFields = (fields, first) => [...first.map(name => fields.find(f => f.name === name)), ...fields.filter(f => !first.includes(f.name))].map((field, order) => ({ ...field, order }));
  await FormDefinition.create({ moduleName: 'Properties', removedFields: ['area.type'], fields: orderFields([...defaults.Properties.filter(f => f.name !== 'area.type').map(f => f.name === 'bedroom' ? { ...f, options: [{ value: '1+2', label: { en: '1+2', fa: '1+2', tr: '1+2' } }, { value: '1+3', label: { en: '1+3', fa: '1+3', tr: '1+3' } }] } : f), custom], ['inlineReference', 'bedroom', 'title']) });
  await FormDefinition.create({ moduleName: 'Residences', fields: defaults.Residences.map((f, order) => ({ ...f, order,
    ...(f.name === 'constructionStatus' ? { type: 'multiselect', options: [...f.options, { value: 'Resale', label: { en: 'Resale', fa: 'ÙØ±ÙˆØ´ Ù…Ø¬Ø¯Ø¯', tr: 'Ä°kinci el' } }] } : {}) })) });
  await FormDefinition.create({ moduleName: 'Opportunities', fields: orderFields([...defaults.Opportunities, custom], ['inlineReference', 'contact', 'properties', 'opportunityName']) });
  await require('../server/model/schema/property').Property.updateOne({ _id: property._id }, { $set: { price: { amount: 100, currency: 'TRY' }, area: { value: 90, type: 'NET' }, bedroom: '2+1', customFields: { inlineReference: 'Keep property information' } } });
  const opportunity = await require('../server/model/schema/opprtunity').create({ opportunityName: 'Inline Opportunity', contact: contacts[0]._id, properties: [property._id], createBy: actor._id, currency: 'TRY', customFields: { inlineReference: 'Opportunity custom data' } });
  const task = await require('../server/model/schema/task').create({ title: 'Inline Task', category: 'Contact', assignTo: contacts[0]._id, createBy: actor._id });
  const call = await require('../server/model/schema/phoneCall').create({ recipient: 'Customer', callNotes: 'Initial call note', sender: actor._id, createBy: actor._id });
  const email = await require('../server/model/schema/email').create({ recipient: 'customer@example.test', subject: 'Original email subject', message: 'Keep body', sender: actor._id, createBy: actor._id });
  const meeting = await require('../server/model/schema/meeting').create({ agenda: 'Original meeting agenda', dateTime: '2026-11-05T11:00:00Z', createBy: actor._id });
  const invoice = await require('../server/model/schema/invoices').create({ title: 'Original invoice', invoiceNumber: 'INV-77', contact: contacts[0]._id, currency: 'TRY', createBy: actor._id, modifiedBy: actor._id, items: [] });
  const bank = await require('../server/model/schema/bankDetails').create({ accountName: 'Original Account', accountNumber: 123, bank: 'Test Bank', createBy: actor._id });
  const project = await require('../server/model/schema/opportunityproject').create({ name: 'Original Project', requirement: 'Keep requirement', category: 'Contact', contact: contacts[0]._id, property: [property._id], createBy: actor._id });
  const metadata = await require('../server/model/schema/customField').create({ moduleName: 'Inline Records', fields: [{ name: 'title', label: 'Title', type: 'text', backendType: 'String' }] });
  const customRecord = await require('../server/controllers/form/form').getModel(metadata).create({ title: 'Original custom record', createBy: actor._id });
  fixture = { opportunity, task, call, email, meeting, invoice, bank, project, customRecord };
};
exports.check = async ({ page, origin, artifacts, measurements, contacts, leads, property, user }) => {
  const go = async route => { console.log('Inline details browser:', route); await page.goto(origin + route, { waitUntil: 'networkidle2' }); };
  const button = async (selector, label) => {
    await page.waitForFunction((selector, label) => [...document.querySelectorAll(selector)].some(el => el.textContent.trim() === label), {}, selector, label);
    await page.$$eval(selector, (elements, label) => elements.find(el => el.textContent.trim() === label).click(), label);
  };
  const fill = async (selector, value) => { await page.focus(selector); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await page.type(selector, value); };
  const api = async (route, method = 'GET', body) => page.evaluate(async ({ route, method, body }) => {
    const response = await fetch('/api/' + route, { method, headers: { Authorization: localStorage.getItem('token'), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }, { route, method, body });
  const noOverflow = async label => {
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 2, { timeout: 3000 }).catch(() => {});
    const size = await page.evaluate(() => ({ width: innerWidth, page: document.documentElement.scrollWidth }));
    assert(size.page <= size.width + 2, label + ' overflows: ' + JSON.stringify(size)); measurements.push({ label, ...size });
  };
  const edit = async (route, field, value) => {
    await go(route); await page.waitForSelector(`[data-record-field="${field}"].crm-record-field--editable`);
    assert.equal(await page.$('[role="tablist"]'), null, 'Detail sections must share one information flow');
    const target = await page.$(`[data-record-field="${field}"] dd`); await target.click({ count: 2 });
    const input = `[data-record-field="${field}"] input, [data-record-field="${field}"] textarea`;
    await page.waitForSelector(input); await fill(input, value);
    const response = page.waitForResponse(r => r.request().method() === 'PUT' && /\/api\//.test(r.url()));
    await button('.crm-field-editor-actions button', 'Save'); const result = await response;
    assert.equal(result.status(), 200, await result.text());
    const submitted = JSON.parse(result.request().postData());
    assert.deepEqual(Object.keys(submitted).filter(key => key !== 'moduleId'), [field], 'Inline editing must send only its changed field');
    await page.waitForFunction(() => !document.querySelector('.crm-field-editor'));
    await go(route); await page.waitForFunction((field, value) => document.querySelector(`[data-record-field="${field}"] dd`)?.textContent.includes(value), {}, field, value);
    assert(parseFloat(await page.$eval(`[data-record-field="${field}"] dt`, el => getComputedStyle(el).fontSize)) >= 14);
  };
  await edit('/contactView/' + contacts[0]._id, 'fullName', 'Inline Customer');
  await edit('/leadView/' + leads[0]._id, 'leadName', 'Inline Lead');
  await edit('/opportunitiesView/' + fixture.opportunity._id, 'opportunityName', 'Updated Opportunity');
  await edit('/view/' + fixture.task._id, 'title', 'Updated Task');
  await edit('/phone-call/' + fixture.call._id, 'callNotes', 'Updated call note');
  await edit('/Email/' + fixture.email._id, 'subject', 'Updated email subject');
  await edit('/metting/' + fixture.meeting._id, 'agenda', 'Updated meeting agenda');
  await edit('/invoicesView/' + fixture.invoice._id, 'title', 'Updated Invoice');
  await edit('/userView/' + user._id, 'firstName', 'Updated Reviewer');
  await edit('/inline-records/' + fixture.customRecord._id, 'title', 'Updated Custom Record');
  await go('/contactView/' + contacts[0]._id); await page.waitForSelector('[data-record-field="fullName"]');
  await page.evaluate(route => { history.pushState({}, '', route); dispatchEvent(new PopStateEvent('popstate')); }, '/contactView/' + contacts[1]._id);
  await page.waitForFunction(() => document.querySelector('.crm-detail-heading')?.textContent.includes('Customer 02') && document.querySelector('[data-record-field="fullName"] dd')?.textContent === 'Customer 02');

  await go('/opportunitiesView/' + fixture.opportunity._id); await page.waitForSelector('[data-record-field="contact"].crm-record-field--editable');
  await (await page.$('[data-record-field="contact"] dd')).click({ count: 2 });
  await page.waitForSelector('.crm-field-editor input[name="contact"]'); await fill('.crm-field-editor input[name="contact"]', 'Customer 02');
  await page.waitForFunction(() => [...document.querySelectorAll('[role="option"]')].some(el => el.textContent.includes('Customer 02')));
  await page.keyboard.press('Enter');
  assert(await page.$('.crm-field-editor'), 'Choosing a related record must not submit the edit');
  assert.equal((await api('record-workspace/Opportunities/' + fixture.opportunity._id)).data.record.contact, String(contacts[0]._id));
  await button('.crm-field-editor-actions button', 'Cancel');

  // Check ordering across separate legacy system, custom and relation containers.
  await go('/opportunitiesView/' + fixture.opportunity._id); await button('.crm-opportunity-detail-toolbar button', 'Edit');
  await page.waitForSelector('.crm-managed-layout [data-field-path="customFields.inlineReference"]');
  await page.waitForFunction(() => { const rect = document.querySelector('.crm-managed-layout')?.getBoundingClientRect(); return rect && rect.right <= innerWidth + 2 && rect.left >= 0; });
  const managed = await page.$$eval('.crm-managed-layout [data-field-path]', elements => elements.filter(el => !el.parentElement.closest('[data-field-path]') && el.getBoundingClientRect().height > 0).map(el => ({ name: el.dataset.fieldPath, top: el.getBoundingClientRect().top, left: el.getBoundingClientRect().left, order: Number(getComputedStyle(el).order) })).sort((a,b) => a.top-b.top || a.left-b.left));
  assert(managed.length > 8); assert.deepEqual(managed.slice(0,4).map(f => f.name), ['customFields.inlineReference', 'contact', 'properties', 'opportunityName'], JSON.stringify(managed));
  for (let i=1; i<managed.length; i++) assert(managed[i].order >= managed[i-1].order, 'Managed fields escaped configured order');
  measurements.push({ managed }); await page.screenshot({ path: path.join(artifacts, 'managed-opportunity-order.png') });

  // A real up/down action in Form Builder must move the visible form too.
  await go('/form-builder'); await page.waitForSelector('.crm-builder-field');
  await page.$$eval('.crm-builder-field', elements => elements.find(el => el.textContent.startsWith('Title')).click());
  await page.click('button[aria-label="Move up"]');
  const saved = page.waitForResponse(r => r.url().endsWith('/estate/definitions/Properties') && r.request().method() === 'PUT');
  await page.click('[data-testid="save-form"]'); assert.equal((await saved).status(), 200);
  await go('/properties'); await button('.crm-entity-page button', 'Add New'); await page.waitForSelector('input[name="title"]');
  assert.deepEqual(await page.$$eval('.crm-entity-modal .crm-dynamic-field', elements => elements.slice(0,3).map(el => el.dataset.fieldPath)), ['customFields.inlineReference', 'title', 'bedroom']);
  await page.screenshot({ path: path.join(artifacts, 'configured-property-order.png'), fullPage: true });
  await button('.crm-entity-modal button', 'Close');

  await go('/propertyView/' + property._id); await page.waitForSelector('.crm-entity-modal [data-record-field="bedroom"]');
  await (await page.$('[data-record-field="bedroom"] dd')).click({ count: 2 });
  assert.equal(await page.$eval('select[name="bedroom"]', el => el.value), '1+2', 'Canonical stored plans must select the configured reversed option');
  await page.select('select[name="bedroom"]', '1+3');
  await button('.crm-field-editor-actions button', 'Save'); await page.waitForFunction(() => !document.querySelector('.crm-field-editor'));
  assert.equal((await api('estate/Properties/' + property._id)).data.bedroom, '3+1');
  assert.equal((await api('estate/Properties/' + property._id)).data.customFields.inlineReference, 'Keep property information');

  const createResidence = async (selector, name, saveLabel) => {
    await page.waitForSelector(selector + ' input[name="name"]'); await fill(selector + ' input[name="name"]', name);
    await page.$$eval(selector + ' label', elements => { const label = elements.find(el => el.textContent.trim() === 'Resale'); if (!label) throw Error('Resale choice missing'); label.click(); });
    const response = page.waitForResponse(r => r.url().endsWith('/api/estate/Residences') && r.request().method() === 'POST');
    await button(selector + ' button', saveLabel); const result = await response; assert.equal(result.status(), 201, await result.text());
    const data = await result.json(); assert.deepEqual(data.constructionStatus, ['Resale']); return data;
  };
  await go('/residences'); await button('.crm-entity-page button', 'Add New');
  const residence = await createResidence('.crm-entity-modal', 'Browser Residence', 'Save');
  await go('/residences'); await page.waitForFunction(() => document.querySelector('.crm-entity-page')?.textContent.includes('Browser Residence'));
  await page.$$eval('.crm-record-row', elements => elements.find(el => el.textContent.includes('Browser Residence')).querySelector('button[aria-label="Details"]').click());
  await page.waitForSelector('[data-record-field="name"]'); await (await page.$('[data-record-field="name"] dd')).click({ count: 2 });
  await fill('input[name="name"]', 'Edited Residence'); await button('.crm-field-editor-actions button', 'Save');
  await page.waitForFunction(() => !document.querySelector('.crm-field-editor')); assert.equal((await api('estate/Residences/' + residence._id)).data.name, 'Edited Residence');

  // The same creation path is also available inside the property form.
  await go('/properties'); await button('.crm-entity-page button', 'Add New');
  await page.waitForSelector('#field-isInsideResidence');
  await page.$eval('#field-isInsideResidence', input => input.closest('label').click());
  await button('.crm-entity-modal button', 'Create New Residence');
  const nested = await createResidence('.crm-catalog-dialog', 'Nested Residence', 'Save and Select');
  await page.waitForFunction(() => !document.querySelector('.crm-catalog-dialog'));
  await page.waitForFunction(() => document.querySelector('input[name="residence"]')?.value === 'Nested Residence');
  assert(nested._id);

  await go('/contacts'); await page.waitForSelector('.crm-record-row .crm-contact-transfer');
  assert.equal(await page.$('.crm-contact-name-cell .crm-contact-transfer'), null);
  assert(await page.$eval('.crm-record-row .crm-contact-transfer', el => el.closest('td').dataset.mobileRole === 'actions'));
  for (const [language,width] of [['en',1440], ['fa',375], ['tr',320]]) {
    await page.setViewport({ width, height: 850 }); await page.select('.crm-language-select select', language);
    await page.waitForFunction(language => document.documentElement.lang === language, {}, language);
    assert(await page.$eval('.crm-record-row .crm-contact-transfer', el => el.closest('td').dataset.label === el.textContent.trim()), 'Transfer column and button must translate together');
    await noOverflow('contact table ' + language); await page.screenshot({ path: path.join(artifacts, 'contact-table-' + language + '.png'), fullPage: true });
    await go('/contactView/' + contacts[0]._id); await page.waitForSelector('.crm-record-field'); await noOverflow('contact view ' + language);
    if (language === 'fa') {
      await (await page.$('[data-record-field="fullName"] dd')).click({ count: 2 });
      await page.waitForSelector('.crm-field-editor input[name="fullName"]'); await noOverflow('mobile direct editor');
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.crm-field-editor'));
    }
    await go('/opportunitiesView/' + fixture.opportunity._id); await page.waitForSelector('.crm-record-field'); await noOverflow('opportunity view ' + language);
    await page.screenshot({ path: path.join(artifacts, 'opportunity-details-' + language + '.png'), fullPage: true });
    assert.equal(await page.$('[role="tablist"]'), null);
    await go('/contacts'); await page.waitForSelector('.crm-record-row .crm-contact-transfer');
  }
  await page.select('.crm-language-select select', 'en');
  console.log('PASS: direct field editing, unified views, form ordering, room aliases, both residence creation paths, transfer column and multilingual mobile layouts.');
};

