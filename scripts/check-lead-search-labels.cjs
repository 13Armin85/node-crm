const assert = require('node:assert/strict');
const path = require('node:path');

exports.seed = async ({ actor, leads, CustomField, Property, User }) => {
  // Reproduce already-saved example metadata, rather than relying on new seeds.
  const module = await CustomField.findOne({ moduleName: 'Leads' });
  for (const field of module.fields.filter(field => ['associatedListing', 'assignUser'].includes(field.name))) {
    field.isTableField = true;
    field.options = [{ name: 'From Project 1', value: 'From Project 1' }, { name: 'Project 2', value: 'Project 2' }];
  }
  await module.save();
  const agent = await User.create({ firstName: 'Second', lastName: 'Agent', username: 'search-agent@example.test', password: 'unused-test-only', role: 'user' });
  const property = await Property.create({ title: 'Harbor Flat', createBy: actor._id });
  leads[1].set({ assignUser: agent._id, associatedListing: property._id }); await leads[1].save();
};

exports.check = async ({ page, origin, artifacts, measurements }) => {
  const scenarios = [{ width: 1440, language: 'en', mode: 'light' }, { width: 390, language: 'fa', mode: 'light' }, { width: 320, language: 'tr', mode: 'dark' }];
  await page.goto(origin + '/lead', { waitUntil: 'networkidle2' });
  for (const scenario of scenarios) {
    console.log('Checking lead advanced search: ' + scenario.width + ' / ' + scenario.language);
    await page.evaluate(({ language, mode }) => { localStorage.setItem('crm-language', language); localStorage.setItem('chakra-ui-color-mode', mode); }, scenario);
    await page.setViewport({ width: scenario.width, height: 900 });
    const open = async () => {
      await page.goto(origin + '/lead', { waitUntil: 'networkidle2' });
      await page.waitForSelector('.crm-record-row');
      await page.$eval('.crm-table-toolbar__main > button', button => button.click());
      await page.waitForSelector('.crm-advanced-search', { visible: true });
      await page.waitForSelector('.crm-advanced-search select[name="associatedListing"] option:nth-child(3)');
    };
    await open();
    const choices = await page.$$eval('.crm-advanced-search select[name="associatedListing"] option, .crm-advanced-search select[name="assignUser"] option', options => options.filter(option => option.value).map(option => ({ value: option.value, text: option.textContent })));
    for (const label of ['Garden Villa', 'Harbor Flat', 'Workspace Reviewer', 'Second Agent']) assert(choices.some(option => option.text === label), 'Real name missing: ' + label);
    assert(!choices.some(option => /Project|پروژه|Proje|^[a-f\d]{24}$/i.test(option.text)), 'Sample label or ID is visible');
    for (const option of choices) assert(/^[a-f\d]{24}$/i.test(option.value), 'Relationship ID was replaced by a display label');
    const geometry = await page.$eval('.crm-advanced-search', node => { const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: innerWidth, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }; });
    assert(geometry.left >= -1 && geometry.right <= geometry.width + 1 && geometry.scrollWidth <= geometry.clientWidth + 1, 'Advanced search overflows');
    await page.screenshot({ path: path.join(artifacts, `lead-search-${scenario.width}-${scenario.language}.png`) });
    const selectedProperty = choices.find(option => option.text === 'Harbor Flat').value;
    await page.select('.crm-advanced-search select[name="associatedListing"]', selectedProperty);
    await page.$eval('.crm-advanced-search button[type="submit"]', button => button.click());
    await page.waitForSelector('.crm-advanced-search', { hidden: true });
    await page.waitForFunction(() => document.querySelectorAll('.crm-record-row').length === 1);
    assert((await page.$eval('.crm-record-row', row => row.innerText)).includes('Transfer contactAndOpportunity'), 'Property filter did not match its populated record');
    const filteredText = await page.$eval('.crm-content', node => node.innerText);
    assert(filteredText.includes('Harbor Flat') && !filteredText.includes(selectedProperty), 'Selected property label was lost or exposed its ID');
    await open();
    await page.select('.crm-advanced-search select[name="assignUser"]', choices.find(option => option.text === 'Workspace Reviewer').value);
    await page.$eval('.crm-advanced-search button[type="submit"]', button => button.click());
    await page.waitForSelector('.crm-advanced-search', { hidden: true });
    await page.waitForFunction(() => document.querySelectorAll('.crm-record-row').length === 1);
    const text = await page.$eval('.crm-record-row', row => row.innerText);
    assert(text.includes('Transfer contact') && !text.includes('Transfer contactAndOpportunity'), 'Assigned-user filter did not match its populated record');
    measurements.push({ type: 'lead-search-labels', scenario, choices, geometry });
  }
  console.log('PASS: advanced search uses actual property and user names from populated leads, retains IDs in values, and filters by each relationship in English, Persian and Turkish at desktop and mobile sizes.');
};
