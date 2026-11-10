const assert = require('node:assert/strict');
const path = require('node:path');

exports.check = async ({ page, origin, artifacts, measurements }) => {
  const goto = route => page.goto(origin + route, { waitUntil: 'networkidle2' });
  const input = async (selector, value) => {
    await page.$eval(selector, (element, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  };
  const chooseField = async label => {
    await page.waitForSelector('.crm-builder-field');
    await page.evaluate(label => {
      const button = [...document.querySelectorAll('.crm-builder-field')].find(button => button.textContent.startsWith(label));
      if (!button) throw new Error('Missing builder field: ' + label);
      button.click();
    }, label);
  };
  const save = async () => {
    const pending = page.waitForResponse(response => response.url().endsWith('/api/estate/definitions/Properties') && response.request().method() === 'PUT');
    await page.click('[data-testid="save-form"]');
    const response = await pending; assert.equal(response.status(), 200, await response.text());
    await page.waitForFunction(() => document.querySelector('[data-testid="save-form"]').disabled);
    return response.json();
  };
  const open = async () => {
    await goto('/properties');
    await page.waitForSelector('.crm-page-hero');
    await page.evaluate(() => [...document.querySelectorAll('.crm-page-hero button')].find(button => /Add|افزودن/.test(button.textContent)).click());
    await page.waitForSelector('.crm-record-form--sectioned input[name="title"]');
  };
  // Inspect the full default form before modifying the disposable definition.
  for (const scenario of [{ language: 'en', width: 1440 }, { language: 'fa', width: 1440 }, { language: 'fa', width: 390 }]) {
    await goto('/properties');
    await page.evaluate(language => localStorage.setItem('crm-language', language), scenario.language);
    await page.setViewport({ width: scenario.width, height: 960 });
    await open();
    const layout = await page.$eval('.crm-record-form--sectioned', modal => {
      const rect = modal.getBoundingClientRect();
      const selects = [...modal.querySelectorAll('.chakra-select__wrapper')].map(wrapper => {
        const input = wrapper.querySelector('select').getBoundingClientRect();
        const icon = wrapper.querySelector('.chakra-select__icon-wrapper').getBoundingClientRect();
        return { left: icon.x < input.x + input.width / 2, inputWidth: input.width };
      });
      const relation = modal.querySelector('[name="propertyAgent"]').parentElement;
      const relationArrow = relation.querySelector('.chakra-input__right-element').getBoundingClientRect();
      const relationRect = relation.getBoundingClientRect();
      const bedroom = modal.querySelector('.crm-bedroom-picker');
      const bedroomArrow = bedroom.querySelector('.chakra-input__right-element').getBoundingClientRect();
      const bedroomRect = bedroom.getBoundingClientRect();
      return { width: rect.width, fits: rect.left >= 0 && rect.right <= innerWidth + 1,
        selects, relationLeft: relationArrow.x < relationRect.x + relationRect.width / 2,
        bedroomLeft: bedroomArrow.x < bedroomRect.x + bedroomRect.width / 2 };
    });
    assert(layout.fits); if (scenario.width > 1000) assert(layout.width >= 800);
    const left = scenario.language === 'fa';
    for (const select of layout.selects) assert.equal(select.left, left, 'Native select arrow direction');
    assert.equal(layout.relationLeft, left, 'Relation arrow direction');
    assert.equal(layout.bedroomLeft, left, 'Bedroom arrow direction');
    await page.screenshot({ path: path.join(artifacts, `property-form-${scenario.language}-${scenario.width}.png`) });
    measurements.push({ type: 'property-form-layout', scenario, layout });
  }
  await page.evaluate(() => localStorage.setItem('crm-language', 'en'));
  await page.setViewport({ width: 1440, height: 960 });
  await goto('/form-builder');
  await page.waitForSelector('[data-testid="field-label-en"]');
  for (const label of ['Price', 'Area Value', 'Building Age']) {
    // Area labels differ across older catalogs, so use the editor's stable name.
    if (label === 'Area Value') {
      const buttons = await page.$$('.crm-builder-field');
      let found = false;
      for (const button of buttons) {
        await button.click();
        if (await page.$eval('[data-testid="field-editor"]', editor => editor.textContent.includes('area.value'))) { found = true; break; }
      }
      assert(found, 'Area field is available for deletion');
    } else await chooseField(label);
    await page.click('[data-testid="delete-field"]');
  }
  await chooseField('Occupancy Status');
  await page.click('[data-testid="delete-option-0"]');
  await chooseField('Title');
  await input('[data-testid="field-label-en"]', 'Listing headline');
  await input('[data-testid="field-helpText-en"]', 'A clear name for the listing');
  await page.select('[data-testid="field-type"]', 'textarea');
  await page.click('[data-testid="add-field"]');
  for (const language of ['en', 'fa', 'tr']) await input(`[data-testid="field-label-${language}"]`, 'Viewing reference');
  await page.click('[data-testid="field-required"]');
  await page.click('[aria-label="Move up"]');
  const definition = await save();
  const custom = definition.fields.find(field => field.label.en === 'Viewing reference');
  assert(custom?.required);
  for (const name of ['price.amount', 'area.value', 'buildingAge']) assert(!definition.fields.some(field => field.name === name));
  await goto('/properties');
  await page.evaluate(() => [...document.querySelectorAll('.crm-page-hero button')].find(button => button.textContent.includes('Add')).click());
  await page.waitForSelector('textarea[name="title"]');
  for (const name of ['price.amount', 'area.value', 'buildingAge']) assert.equal(await page.$(`[name="${name}"]`), null);
  assert.equal(await page.$eval('[name="occupancyStatus"]', select => [...select.options].some(option => option.value === 'EMPTY')), false);
  assert(await page.$eval('.crm-record-form--sectioned', modal => modal.textContent.includes('Listing headline') && modal.textContent.includes('A clear name for the listing')));
  const rendered = await page.$$eval('.crm-dynamic-field', fields => fields.map(field => field.dataset.fieldPath));
  const expected = definition.fields.filter(field => field.enabled !== false && !['residence', 'sale.buyerType', 'sale.lead', 'sale.partnerCustomer', 'sale.soldAt'].includes(field.name)).map(field => field.kind === 'CUSTOM_FIELD' ? 'customFields.' + field.name : field.name);
  assert.deepEqual(rendered, expected, 'The form follows exact administrator field order');
  await page.$eval('textarea[name="title"]', element => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(element, 'Configured property'); element.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.select('[name="subtype"]', 'APARTMENT');
  await page.evaluate(() => [...document.querySelectorAll('.chakra-modal__footer button')].find(button => button.textContent === 'Save').click());
  await page.waitForFunction(() => document.querySelector('[name^="customFields."]')?.getAttribute('aria-invalid') === 'true');
  await input(`[name="customFields.${custom.name}"]`, 'REF-24');
  const pending = page.waitForResponse(response => response.url().endsWith('/api/estate/Properties') && response.request().method() === 'POST');
  await page.evaluate(() => [...document.querySelectorAll('.chakra-modal__footer button')].find(button => button.textContent === 'Save').click());
  const created = await pending; assert.equal(created.status(), 201, await created.text());
  assert.equal((await created.json()).customFields[custom.name], 'REF-24');
  // Remove the custom field through the same real administration UI.
  await goto('/form-builder'); await chooseField('Viewing reference');
  await page.click('[data-testid="delete-field"]'); await save();
  await goto('/form-builder'); await page.waitForSelector('.crm-builder-field');
  assert.equal(await page.$$eval('.crm-builder-field', fields => fields.some(field => field.textContent.includes('Viewing reference'))), false);
  measurements.push({ type: 'property-form-builder', removed: ['price.amount', 'area.value', 'buildingAge', custom.name], created: created.status(), order: rendered });
  console.log('PASS: property form desktop/mobile, Persian left arrows, real Form Builder delete/type/label/help/options/order/required/custom field changes and property creation.');
};
