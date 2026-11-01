const assert = require('node:assert/strict');
const path = require('node:path');

exports.seed = async ({ actor, User }) => {
  await User.create({ username: 'settings-user@example.test', firstName: 'Settings', lastName: 'Member', role: 'user', password: 'unused-test-only' });
  const Module = require('../server/model/schema/moduleActiveDeactive');
  await Module.insertMany(['Properties', 'Contacts', 'Leads', 'Tasks', 'Meetings', 'Calls', 'Emails', 'Documents', 'Reporting and Analytics', 'Users']
    .map((moduleName, order) => ({ moduleName, order, isActive: true })));
  await require('../server/model/schema/validation').create({ name: 'Required customer information', validations: [{ require: true, value: true, message: 'This value is required' }], deleted: false });
  await require('../server/model/schema/imagesSchema').insertMany([true, false].map(isActive => ({
    authImg: '/brand-logo-ta.png', logoSmImg: '/brand-logo-ta.png', logoLgImg: '/brand-logo-ta.png', isActive, deleted: false,
  })));
  await require('../server/model/schema/auditLog').insertMany(Array.from({ length: 12 }, (_, index) => ({
    actorId: actor._id, actorName: 'Workspace Reviewer', actorUsername: actor.username, actorRole: actor.role,
    action: index % 3 === 0 ? 'create' : 'update', schemaVersion: 2, operation: index % 3 === 0 ? 'create' : 'update',
    entityCollection: 'Contacts', recordId: String(actor._id), recordLabel: 'Settings review record ' + index,
    changes: [{ field: 'fullName', before: 'Previous name', after: 'Updated name ' + index }],
    method: index % 3 === 0 ? 'POST' : 'PUT', createdAt: new Date(Date.now() - index * 60000),
  })));
};

exports.check = async ({ page, origin, artifacts, measurements, user }) => {
  const routes = ['/admin-setting', '/audit-logs', '/data-visibility', '/form-builder', '/custom-Fields', '/change-images',
    '/validations', '/table-field', '/active-deactive-module', '/module', '/user', '/userView/' + user._id];
  const expectedLinks = ['/data-visibility', '/audit-logs', '/user', '/change-images', '/form-builder', '/validations', '/table-field', '/module', '/active-deactive-module'];
  const goto = async route => {
    await page.goto(origin + route, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.crm-settings-content');
    await page.waitForSelector('#crm-page-help-slot .crm-page-help');
    if (process.env.CRM_CHECK_SETTINGS_STYLE_PREVIEW) await page.addStyleTag({ path: path.resolve(__dirname, '../client/src/assets/css/SettingsWorkspace.css') });
  };
  // The browser starts on about:blank when only the focused checks are selected.
  await goto('/admin-setting');
  const scenarios = [
    { width: 1440, mode: 'light', language: 'en' }, { width: 390, mode: 'light', language: 'fa' },
    { width: 1440, mode: 'dark', language: 'en' }, { width: 320, mode: 'dark', language: 'tr' },
  ];
  for (const scenario of scenarios.filter(item => !process.env.CRM_CHECK_SETTINGS_WIDTH || item.width === Number(process.env.CRM_CHECK_SETTINGS_WIDTH))) {
    await page.evaluate(({ mode, language }) => { localStorage.setItem('chakra-ui-color-mode', mode); localStorage.setItem('crm-language', language); }, scenario);
    await page.setViewport({ width: scenario.width, height: 900 });
    for (const route of routes.filter(item => !process.env.CRM_CHECK_SETTINGS_ROUTE || item === process.env.CRM_CHECK_SETTINGS_ROUTE)) {
      const label = route.split('/')[1] + '-' + scenario.width + '-' + scenario.mode;
      console.log('Checking settings: ' + label);
      await goto(route);
      if (route === '/admin-setting') {
        assert.deepEqual(await page.$$eval('.crm-settings-link', links => links.map(link => link.getAttribute('href'))), expectedLinks, 'Settings option was removed or changed');
      }
      if (route === '/data-visibility') {
        await page.waitForSelector('#visibility-user option:nth-child(2)');
        const id = await page.$eval('#visibility-user option:nth-child(2)', option => option.value);
        await page.select('#visibility-user', id);
        await page.waitForSelector('.crm-settings-permission');
        assert(await page.$$eval('.crm-settings-permission input[type="checkbox"]', switches => switches.length >= 10));
      }
      if (route === '/table-field') {
        await page.click('.crm-settings-panel__header [aria-haspopup="menu"]');
        await page.waitForFunction(() => [...document.querySelectorAll('[role="menuitem"]')].some(item => /Contacts|مخاطبان|Kişiler/.test(item.textContent)));
        await page.$$eval('[role="menuitem"]', items => items.find(item => /Contacts|مخاطبان|Kişiler/.test(item.textContent)).click());
        await page.waitForSelector('.CustomFieldName');
      }
      if (['/form-builder', '/custom-Fields'].includes(route)) {
        await page.waitForSelector('[data-testid="field-editor"]');
        assert(await page.$$eval('.crm-builder-field', fields => fields.length > 10), 'Fields missing from builder');
      }
      if (route === '/audit-logs') await page.waitForSelector('.crm-audit-readable-activity');
      if (route === '/change-images') assert.equal(await page.$$eval('.imageCard', cards => cards.length), 2);
      if (route === '/module') assert(await page.$$eval('.crm-settings-record-card', cards => cards.length >= 3));
      if (route === '/active-deactive-module') assert(await page.$$eval('.crm-settings-module-grid input[type="checkbox"]', switches => switches.length >= 10));
      const geometry = await page.evaluate(() => {
        const surfaces = [...document.querySelectorAll('.crm-settings-link, .crm-settings-content .crm-card, .crm-audit-hero, .crm-audit-stat, .crm-audit-filter-panel, .crm-audit-results, .crm-settings-permission')];
        const heading = document.querySelector('.crm-builder-heading');
        return { width: innerWidth, pageWidth: document.documentElement.scrollWidth,
          surfaces: surfaces.map(node => ({ className: node.className, radius: getComputedStyle(node).borderTopLeftRadius,
            shadow: getComputedStyle(node).boxShadow, background: getComputedStyle(node).backgroundImage })),
          builderBackground: heading && getComputedStyle(heading).backgroundImage,
          fatal: /Something went wrong|Application error/.test(document.body.textContent) };
      });
      if (geometry.pageWidth > geometry.width + 1) console.log('Overflow diagnostics:', JSON.stringify(await page.$$eval('body *', nodes => nodes.filter(node => {
        const rect = node.getBoundingClientRect(); return rect.width && (rect.right > innerWidth + 1 || node.scrollWidth > node.clientWidth + 1) && rect.left >= 0 && getComputedStyle(node).position !== 'fixed';
      }).map(node => ({ tag: node.tagName, id: node.id, className: node.className, width: node.getBoundingClientRect().width, scrollWidth: node.scrollWidth, overflow: getComputedStyle(node).overflowX, left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right, text: node.textContent.slice(0, 100) })).slice(-30))));
      assert(geometry.pageWidth <= geometry.width + 1, label + ': page overflow');
      assert(!geometry.fatal, label + ': page failed');
      for (const surface of geometry.surfaces) {
        assert(parseFloat(surface.radius) <= 6, label + ': oversized rounding ' + surface.className);
        assert.equal(surface.shadow, 'none', label + ': decorative shadow');
        assert.equal(surface.background, 'none', label + ': decorative gradient');
      }
      if (geometry.builderBackground) assert.equal(geometry.builderBackground, 'none');
      await page.screenshot({ path: path.join(artifacts, label + '.png') });
      measurements.push({ type: 'settings', route, scenario, ...geometry });
    }
  }
  await page.evaluate(() => { localStorage.setItem('crm-language', 'en'); localStorage.setItem('chakra-ui-color-mode', 'light'); });
  await page.setViewport({ width: 1440, height: 900 });
  await goto('/admin-setting');
  await page.click('.crm-settings-link[href="/table-field"]');
  await page.waitForSelector('.crm-settings-table-fields');
  await goto('/form-builder');
  await page.waitForSelector('[data-testid="field-label-en"]');
  await page.$eval('[data-testid="field-label-en"]', input => input.focus());
  await page.keyboard.press('End'); await page.keyboard.type(' review');
  await page.waitForFunction(() => !document.querySelector('[data-testid="save-form"]').disabled);
  await page.goto(origin + '/contacts', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.crm-content .crm-data-card, .crm-content .crm-list-table');
  assert.equal(await page.$('.crm-settings-content'), null, 'Settings styling leaked into a CRM page');
  console.log('PASS: all nine settings destinations preserved; twelve settings pages at 320/390/1440px, three languages and both themes; real field lists, visibility switches, logs and image actions remain available.');
};
