const assert = require('node:assert/strict');
const path = require('node:path');
let sources, propertyId;
exports.seed = async ({ actor, leads, property }) => {
  const { Lead } = require('../server/model/schema/lead');
  const Definition = require('../server/model/schema/formDefinition');
  const { defaults } = require('../server/services/formDefinitions');
  const Note = require('../server/model/schema/recordNote');
  const Document = require('../server/model/schema/document');
  const extra = await Lead.create({ leadName: 'Opportunity only customer', leadEmail: 'opportunity-only@example.test',
    leadMessage: 'Complete opportunity source message', customFields: { reference: 'Original opportunity-only custom value', budget: 0 },
    assignUser: actor._id, createBy: actor._id });
  sources = [leads[0], extra, leads[1]].map(source => source.toObject());
  await Definition.create({ moduleName: 'Leads', fields: [...defaults.Leads,
    { name: 'reference', kind: 'CUSTOM_FIELD', type: 'text', enabled: true, label: { en: 'Source reference', fa: 'Source reference', tr: 'Source reference' } },
    { name: 'budget', kind: 'CUSTOM_FIELD', type: 'number', enabled: true, label: { en: 'Original budget', fa: 'Original budget', tr: 'Original budget' } },
  ] });
  await Definition.create({ moduleName: 'Properties', fields: defaults.Properties.filter(field => ['title', 'category', 'subtype', 'transactionType', 'price.amount', 'price.currency', 'area.value', 'area.type', 'bedroom', 'sale.status'].includes(field.name)) });
  const Property = require('../server/model/schema/property').Property;
  await Property.updateOne({ _id: property._id }, { $set: { price: { amount: 100, currency: 'TRY' }, area: { value: 90, type: 'NET' }, bedroom: '1+2' } });
  propertyId = String(property._id);
  for (const source of sources) {
    await Note.create({ module: 'Leads', record: source._id, author: actor._id, text: 'Original note for ' + source.leadName, clientId: 'source-note' });
    await Document.create({ folderName: 'Source files ' + source._id, createBy: actor._id, file: [{ fileName: 'Transferred-' + source._id + '.pdf',
      path: '/test/file.pdf', linkLead: source._id, entityType: 'Lead', entityId: source._id }] });
  }
};
exports.check = async ({ page, origin, artifacts }) => {
  const { Contact } = require('../server/model/schema/contact');
  const Opportunity = require('../server/model/schema/opprtunity');
  await page.setViewport({ width: 1440, height: 950 });
  const labels = ['Transfer to contacts', 'Transfer to opportunities', 'Transfer to contacts and opportunities'];
  for (const [index, source] of (process.env.CRM_CHECK_BEDROOM_ONLY ? [] : sources).entries()) {
    console.log('Checking complete transfer in browser:', labels[index]);
    await page.goto(origin + '/leadView/' + source._id, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button[aria-label="' + labels[index] + '"]');
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/lead/convert/' + source._id) && response.request().method() === 'POST');
    await page.click('button[aria-label="' + labels[index] + '"]');
    const response = await responsePromise, result = await response.json();
    assert.equal(response.status(), 200, JSON.stringify(result));
    for (const [Model, id, route] of [[Contact, result.contactId, '/contactView/'], [Opportunity, result.opportunityId, '/opportunitiesView/']]) {
      if (!id) continue;
      const record = await Model.findById(id).lean();
      assert.deepEqual(record.convertedLeads[0].values.customFields, source.customFields);
      await page.goto(origin + route + id, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(message => document.body.textContent.includes(message), {}, source.leadMessage);
      await page.waitForFunction(reference => document.body.textContent.includes(reference), {}, source.customFields.reference);
      await page.waitForFunction(text => document.body.textContent.includes(text), {}, 'Original note for ' + source.leadName);
      await page.screenshot({ path: path.join(artifacts, 'full-transfer-' + index + '-' + Model.modelName + '.png') });
    }
  }
  console.log('Checking free bedroom entry, exact order and reload');
  await page.goto(origin + '/properties', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.crm-record-row');
  await page.click('.crm-record-row button[aria-label="Edit"]');
  await page.waitForSelector('input[name="bedroom"]');
  for (const value of ['0+1', '1+0', '1+2', '2+1', '99+17', 'Studio']) {
    await page.$eval('input[name="bedroom"]', (input, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/estate/Properties/' + propertyId) && response.request().method() === 'PUT');
    await page.evaluate(() => { [...document.querySelectorAll('.chakra-modal__footer button')].find(button => /Save|Update/.test(button.textContent)).click(); });
    const response = await responsePromise; assert.equal(response.status(), 200);
    assert.equal((await response.json()).bedroom, value);
    await page.waitForFunction(() => !document.querySelector('input[name="bedroom"]'));
    await page.waitForSelector('.crm-record-row button[aria-label="Edit"]');
    await page.click('.crm-record-row button[aria-label="Edit"]');
    await page.waitForSelector('input[name="bedroom"]');
    assert.equal(await page.$eval('input[name="bedroom"]', input => input.value), value);
  }
  await page.screenshot({ path: path.join(artifacts, 'free-bedroom-entry.png') });
  await page.click('input[name="bedroom"]');
  await page.waitForSelector('.crm-bedroom-menu__grid', { visible: true });
  const roomChoices = await page.$$eval('.crm-bedroom-choice', choices => choices.map(choice => choice.textContent));
  assert(roomChoices.includes('0+1') && roomChoices.includes('1+0') && roomChoices.includes('2+1'));
  await page.screenshot({ path: path.join(artifacts, 'bedroom-dropdown-desktop.png') });
  await page.evaluate(() => { [...document.querySelectorAll('.crm-bedroom-choice')].find(choice => choice.textContent === '0+1').click(); });
  assert.equal(await page.$eval('input[name="bedroom"]', input => input.value), '0+1');
  await page.setViewport({ width: 375, height: 900 });
  await page.click('input[name="bedroom"]');
  await page.waitForSelector('.crm-bedroom-menu__grid', { visible: true });
  await page.waitForFunction(() => document.querySelector('input[name="bedroom"]')?.getAttribute('aria-expanded') === 'true');
  const fits = await page.$eval('.crm-bedroom-menu', menu => { const rect = menu.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth + 1; });
  assert(fits, 'Bedroom dropdown should fit the mobile viewport');
  await page.screenshot({ path: path.join(artifacts, 'bedroom-dropdown-mobile.png') });
  await page.keyboard.press('Escape');
  await page.evaluate(() => { [...document.querySelectorAll('.chakra-modal__footer button')].find(button => /Cancel|Close/.test(button.textContent)).click(); });
  console.log('PASS: all three transfer paths show the complete source and live notes; arbitrary bedroom values save and reload without changing their order.');
};
