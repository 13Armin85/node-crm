// Browser assertions for shared dialog, export and language styles, using the isolated API fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ page, browser, origin, artifacts, measurements }) => {
  const goto = async route => {
    await page.goto(origin + route, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.crm-header .crm-language-select select');
  };
  const closeDialog = async () => {
    const close = await page.$('.chakra-modal__content .chakra-modal__close-btn');
    if (close) await close.click();
    else {
      const clicked = await page.$$eval('.chakra-modal__content .chakra-modal__footer button', buttons => {
        const cancel = buttons.find(button => /^(Close|Cancel|No)$/.test(button.textContent.trim()));
        if (!cancel) return false;
        cancel.click(); return true;
      });
      if (!clicked) await page.keyboard.press('Escape');
    }
    await page.waitForSelector('.chakra-modal__content', { hidden: true });
  };
  const inspectDialog = async name => {
    console.log('Checking dialog: ' + name);
    await page.waitForSelector('.chakra-modal__content', { visible: true });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.chakra-modal__content')).opacity === '1');
    const result = await page.$eval('.chakra-modal__content', dialog => {
      const css = getComputedStyle(dialog), header = dialog.querySelector('.chakra-modal__header');
      const rect = node => {
        if (!node) return null;
        const { x, y, right, bottom, width, height } = node.getBoundingClientRect();
        return { x, y, right, bottom, width, height };
      };
      return { radius: css.borderRadius, background: css.backgroundImage, blur: css.backdropFilter,
        headerBackground: header && getComputedStyle(header).backgroundImage,
        bounds: rect(dialog), footer: rect(dialog.querySelector('.chakra-modal__footer')),
        width: innerWidth, height: innerHeight, clientWidth: dialog.clientWidth, scrollWidth: dialog.scrollWidth };
    });
    assert.equal(result.radius, '0px', name + ': rounded corners remain');
    assert.equal(result.background, 'none'); assert.equal(result.blur, 'none');
    if (result.headerBackground) assert.equal(result.headerBackground, 'none', name + ': decorative header remains');
    assert(result.bounds.x >= -1 && result.bounds.right <= result.width + 1, name + ': horizontal overflow');
    assert(result.bounds.y >= -1 && result.bounds.bottom <= result.height + 1, name + ': vertical overflow');
    assert(result.scrollWidth <= result.clientWidth + 1, name + ': contents overflow');
    if (result.footer) assert(result.footer.bottom <= result.bounds.bottom + 1, name + ': footer is outside dialog');
    await page.screenshot({ path: path.join(artifacts, name + '.png') });
    measurements.push({ type: 'dialog', name, ...result });
    await closeDialog();
  };

  await goto('/task');
  const downloads = path.join(artifacts, 'downloads'); fs.mkdirSync(downloads, { recursive: true });
  const cdp = await browser.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: downloads });
  const before = new Set(fs.readdirSync(downloads));
  await page.waitForFunction(() => { const button = document.querySelector('.crm-excel-export'); return button && !button.disabled; });
  await page.click('.crm-excel-export');
  let file;
  for (let attempt = 0; attempt < 100; attempt++) {
    file = fs.readdirSync(downloads).find(name => !before.has(name) && !name.endsWith('.crdownload'));
    if (file) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(file, 'Excel download is missing');
  const workbook = new (require('../client/node_modules/exceljs').Workbook)();
  await workbook.xlsx.load(fs.readFileSync(path.join(downloads, file)));
  assert(workbook.worksheets[0].rowCount > 1, 'Downloaded workbook is empty');

  for (const mode of ['light', 'dark']) {
    for (const width of [1440, 390, 320]) {
      console.log('Checking language and export controls: ' + mode + '/' + width);
      await page.evaluate(mode => { localStorage.setItem('chakra-ui-color-mode', mode); localStorage.setItem('crm-language', 'en'); }, mode);
      await page.setViewport({ width, height: 900 }); await goto('/task');
      for (const language of ['en', 'fa', 'tr']) {
        await page.select('.crm-header .crm-language-select select', language);
        await page.waitForFunction(language => localStorage.getItem('crm-language') === language, {}, language);
        const geometry = await page.evaluate(() => {
          const rect = node => {
            const { x, y, width, height, right, bottom } = node.getBoundingClientRect();
            return { x, y, width, height, right, bottom };
          };
          const language = document.querySelector('.crm-header .crm-language-select');
          const button = document.querySelector('.crm-excel-export');
          const css = getComputedStyle(button);
          return { language: rect(language), font: parseFloat(getComputedStyle(language.querySelector('select')).fontSize),
            selectBackground: getComputedStyle(language.querySelector('select')).backgroundColor,
            export: { shadow: css.boxShadow, background: css.backgroundImage, weight: css.fontWeight, icons: button.querySelectorAll('.chakra-button__icon').length },
            controls: [...document.querySelectorAll('.crm-header .crm-sidebar-toggle, .crm-header .crm-page-help, .crm-header-tools > .chakra-button, .crm-header .crm-language-select, .crm-header .crm-header-icon-button, .crm-header .crm-profile-button')]
              .map(rect).filter(rect => rect.width && rect.height).sort((a, b) => a.x - b.x),
            pageWidth: document.documentElement.scrollWidth, width: innerWidth };
        });
        assert(geometry.language.height >= 38 && geometry.language.width >= 124 && geometry.font >= 14, 'Language selector is too small');
        assert.equal(geometry.selectBackground, 'rgba(0, 0, 0, 0)', 'Language selector has a separate inner background');
        assert(geometry.pageWidth <= width + 1, 'Header causes page overflow');
        for (let index = 0; index < geometry.controls.length; index++) {
          const control = geometry.controls[index];
          assert(control.x >= -1 && control.right <= width + 1, 'Header control is outside viewport: ' + JSON.stringify(geometry));
          if (index) assert(control.x >= geometry.controls[index - 1].right - 1, 'Header controls overlap: ' + JSON.stringify(geometry));
        }
        assert.equal(geometry.export.shadow, 'none'); assert.equal(geometry.export.background, 'none');
        assert(Number(geometry.export.weight) <= 600); assert.equal(geometry.export.icons, 1);
        measurements.push({ type: 'controls', mode, width, language, ...geometry });
      }
      await page.screenshot({ path: path.join(artifacts, 'controls-' + mode + '-' + width + '.png') });
    }
    if (process.env.CRM_DIALOG_CONTROLS_ONLY) continue;

    const width = mode === 'light' ? 1440 : 390;
    await page.evaluate(() => localStorage.setItem('crm-language', 'en'));
    await page.setViewport({ width, height: 900 }); await goto('/task');
    await page.click('#crm-page-help-slot button'); await inspectDialog('help-' + mode);
    await page.click('.crm-task-page-hero > div:last-child > button:last-child'); await inspectDialog('task-form-' + mode);
    await page.click('.crm-task-searchbar > button:first-of-type'); await inspectDialog('advanced-search-' + mode);
    const alternate = await page.$eval('.crm-kanban-card select', select => [...select.options].find(option => option.value && option.value !== select.value).value);
    await page.select('.crm-kanban-card select', alternate); await inspectDialog('assignment-alert-' + mode);
    await page.click('.crm-profile-button');
    await page.waitForFunction(() => [...document.querySelectorAll('[role="menuitem"]')].some(item => item.textContent.trim() === 'Change Password'));
    await page.$$eval('[role="menuitem"]', items => items.find(item => item.textContent.trim() === 'Change Password').click());
    await inspectDialog('password-' + mode);
    await goto('/lead'); await page.click('.crm-page-hero__action'); await inspectDialog('lead-drawer-' + mode);
    await goto('/contacts'); await page.click('.crm-page-hero__action'); await inspectDialog('contact-drawer-' + mode);
    await page.click('.crm-record-menu-button');
    await page.waitForFunction(() => [...document.querySelectorAll('[role="menuitem"]')].some(item => item.textContent.trim() === 'Delete'));
    await page.$$eval('[role="menuitem"]', items => items.find(item => item.textContent.trim() === 'Delete').click());
    await inspectDialog('delete-confirmation-' + mode);
    await goto('/properties'); await page.click('.crm-page-hero__action'); await inspectDialog('property-form-' + mode);
    await goto('/documents');
    await page.$$eval('.crm-document-heading button', buttons => buttons.find(button => button.textContent.trim() === 'New folder').click());
    await inspectDialog('folder-' + mode);
    await page.click('.crm-document-heading .crm-page-hero__action'); await inspectDialog('document-upload-' + mode);
  }
  await cdp.detach();
  console.log(process.env.CRM_DIALOG_CONTROLS_ONLY
    ? 'PASS: larger themed language selector in three languages at 320/390/1440px and both color modes; minimal Excel button downloads a valid workbook.'
    : 'PASS: square, themed modal/alert/drawer variants in light and dark mode; larger language selector in three languages at 320/390/1440px; minimal Excel button downloads a valid workbook.');
};
