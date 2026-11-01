const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async ({ page, origin, artifacts, measurements, contacts, leads }) => {
  const goto = route => page.goto(origin + route, { waitUntil: 'networkidle2' });
  const clickText = async (selector, text) => {
    await page.waitForFunction((selector, text) => [...document.querySelectorAll(selector)].some(node => node.textContent.trim() === text), {}, selector, text);
    await page.$$eval(selector, (nodes, text) => nodes.find(node => node.textContent.trim() === text).click(), text);
  };
  const fill = async (selector, value) => {
    await page.$eval(selector, (node, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value);
      node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  };
  const pick = async (selector, text) => {
    await page.click(selector); await page.keyboard.type(text);
    await page.waitForFunction(text => [...document.querySelectorAll('[role="option"]')].some(node => node.getBoundingClientRect().width && node.textContent.includes(text)), {}, text);
    await page.$$eval('[role="option"]', (nodes, text) => nodes.find(node => node.getBoundingClientRect().width && node.textContent.includes(text)).click(), text);
  };
  await goto('/lead');
  for (const scenario of [{ width: 320, language: 'en' }, { width: 390, language: 'fa' }, { width: 1440, language: 'en' }]) {
    console.log('Checking lead mobile actions: ' + scenario.width + ' / ' + scenario.language);
    await page.evaluate(language => localStorage.setItem('crm-language', language), scenario.language);
    await page.setViewport({ width: scenario.width, height: 900 }); await goto('/lead');
    await page.waitForSelector('.crm-lead-row-actions .crm-record-menu-button');
    const geometry = await page.evaluate(() => ({ width: innerWidth, pageWidth: document.documentElement.scrollWidth,
      actions: [...document.querySelectorAll('.crm-lead-row-actions')].map(actions => {
        const card = actions.closest('tr').getBoundingClientRect();
        return [...actions.querySelectorAll('button')].map(button => { const rect = button.getBoundingClientRect(); return { left: rect.left, right: rect.right, cardLeft: card.left, cardRight: card.right }; });
      }),
      mobileColumns: [...document.querySelectorAll('thead th')].filter(node => /Lead Mobile|تلفن همراه لید/.test(node.textContent)).length,
      oldPhoneColumns: [...document.querySelectorAll('thead th')].filter(node => /^Phone Number$/.test(node.textContent.trim())).length,
    }));
    assert(geometry.pageWidth <= geometry.width + 1, 'Lead page overflow');
    assert.equal(geometry.mobileColumns, 1); assert.equal(geometry.oldPhoneColumns, 0);
    if (scenario.width < 768) for (const row of geometry.actions) for (const button of row) assert(button.left >= button.cardLeft - 1 && button.right <= button.cardRight + 1, 'Lead action outside its card');
    await page.click('.crm-lead-row-actions .crm-record-menu-button');
    const menuId = await page.$eval('.crm-lead-row-actions .crm-record-menu-button', node => node.getAttribute('aria-controls'));
    assert(menuId, 'Lead menu button has no target');
    const menuSelector = '[id="' + menuId + '"]';
    await page.waitForSelector(menuSelector, { visible: true });
    const menu = await page.$eval(menuSelector, node => ({ left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right, width: innerWidth }));
    assert(menu.left >= 0 && menu.right <= menu.width + 1, 'Lead menu outside viewport');
    await page.screenshot({ path: path.join(artifacts, `leads-actions-${scenario.width}-${scenario.language}.png`) });
    measurements.push({ type: 'lead-actions', scenario, ...geometry });
  }
  await page.evaluate(() => localStorage.setItem('crm-language', 'en')); await page.setViewport({ width: 1440, height: 960 });
  if (!process.env.CRM_CHECK_CATALOGS_SKIP_TASK) {
  console.log('Checking named contact task creation');
  await goto('/task'); await clickText('.crm-task-page-hero button', 'New Task');
  await page.waitForSelector('[data-task-select="related"]'); await page.waitForNetworkIdle({ idleTime: 500 });
  await page.select('[data-task-select="related"]', 'Contact');
  await page.waitForFunction(() => document.querySelector('[data-task-select="related"]').value === 'Contact');
  await page.waitForSelector('[name="assignTo"][role="combobox"]');
  await pick('[name="assignTo"][role="combobox"]', 'Customer 01');
  await page.waitForFunction(() => document.querySelector('[name="assignTo"]')?.value.includes('Customer 01'));
  await page.screenshot({ path: path.join(artifacts, 'task-contact-name.png') });
  assert(!(await page.$eval('.chakra-modal__content', node => node.innerText)).includes(String(contacts[0]._id)), 'Task picker exposes a contact ID');
  await fill('[name="title"]', 'Named contact follow-up'); await fill('[name="start"]', '2026-12-01T10:00');
  const savedTask = page.waitForResponse(response => response.url().endsWith('/api/task/add') && response.request().method() === 'POST');
  await clickText('.chakra-modal__footer button', 'Save');
  const taskResponse = await savedTask; assert.equal(taskResponse.status(), 200, await taskResponse.text());
  assert.equal(JSON.parse(taskResponse.request().postData()).assignTo, String(contacts[0]._id));
  await page.waitForSelector('.chakra-modal__content', { hidden: true });
  }

  console.log('Checking inline catalog creation and property draft retention');
  await goto('/properties'); await page.click('.crm-page-hero__action'); await page.waitForSelector('#field-title');
  await fill('#field-title', 'Draft property preserved');
  await clickText('.crm-entity-modal button', 'Create New District'); await page.waitForSelector('#new-district-name');
  await fill('#new-district-name', 'Inline District');
  await clickText('.crm-catalog-dialog .chakra-modal__footer button', 'Save and Select');
  await page.waitForSelector('.crm-catalog-dialog', { hidden: true });
  await page.waitForFunction(() => document.querySelector('#field-district').value === 'Inline District');
  assert.equal(await page.$eval('#field-title', node => node.value), 'Draft property preserved');
  await page.click('#field-isInsideResidence');
  await clickText('.crm-entity-modal button', 'Create New Residence'); await page.waitForSelector('.crm-catalog-dialog input[name="name"]');
  await fill('.crm-catalog-dialog input[name="name"]', 'Inline Residence');
  await pick('.crm-catalog-dialog [name="district"]', 'Inline District');
  await clickText('.crm-catalog-dialog .chakra-modal__footer button', 'Save and Select');
  await page.waitForSelector('.crm-catalog-dialog', { hidden: true });
  await page.waitForFunction(() => document.querySelector('#field-residence').value.includes('Inline Residence'));
  assert.equal(await page.$eval('#field-title', node => node.value), 'Draft property preserved');
  for (const [selector, value] of [['#field-category', 'RESIDENTIAL'], ['#field-subtype', 'APARTMENT'], ['#field-price\\.currency', 'TRY'], ['#field-area\\.type', 'NET']]) await page.select(selector, value);
  await page.$eval('input[type="radio"][value="SALE"]', node => node.click());
  await fill('#field-price\\.amount', '125000'); await fill('#field-area\\.value', '90');
  const savedProperty = page.waitForResponse(response => response.url().endsWith('/api/estate/Properties') && response.request().method() === 'POST');
  await clickText('.crm-entity-modal .chakra-modal__footer button', 'Save');
  const propertyResponse = await savedProperty; assert.equal(propertyResponse.status(), 201, await propertyResponse.text());
  const property = await propertyResponse.json(); assert.equal(property.district, 'Inline District'); assert(property.residence);
  await page.waitForSelector('.crm-entity-modal', { hidden: true });
  await goto('/districts'); await page.waitForFunction(() => document.querySelector('.crm-districts-page')?.innerText.includes('Inline District'));
  assert(await page.$('#crm-sidebar a[href="/districts"]'), 'Districts sidebar entry missing');
  await page.screenshot({ path: path.join(artifacts, 'districts-desktop.png') });
  await page.setViewport({ width: 320, height: 900 }); await goto('/districts');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Districts mobile overflow');
  await page.screenshot({ path: path.join(artifacts, 'districts-mobile.png') });
  console.log('PASS: one mobile number column, lead actions within mobile cards, named contact task creation, inline district/residence creation and saved property relationships, independent districts page and sidebar.');
};
