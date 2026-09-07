const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('../server/node_modules/puppeteer');

async function main() {
  assert(process.env.CRM_TEST_EMAIL && process.env.CRM_TEST_PASSWORD, 'Set CRM_TEST_EMAIL and CRM_TEST_PASSWORD');
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    pipe: true,
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto('http://localhost:3000/auth', { waitUntil: 'networkidle2' });
    await page.type('input[name="username"]', process.env.CRM_TEST_EMAIL);
    await page.type('input[name="password"]', process.env.CRM_TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.crm-shell', { timeout: 30000 });
    await page.goto('http://localhost:3000/form-builder', { waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-testid="field-editor"]', { timeout: 30000 });

    const artifacts = path.join(__dirname, '../layout-artifacts');
    fs.mkdirSync(artifacts, { recursive: true });
    for (const width of [1440, 768, 390]) {
      await page.setViewport({ width, height: 1000 });
      for (const language of ['en', 'fa', 'tr']) {
        await page.select('.crm-header select', language);
        await page.waitForFunction(lang => document.documentElement.lang === lang, {}, language);
        await new Promise(resolve => setTimeout(resolve, 250));
        const result = await page.evaluate(() => {
          const box = selector => {
            const rect = document.querySelector(selector).getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, width: rect.width };
          };
          const fields = box('[data-testid="fields-panel"]');
          const editor = box('[data-testid="field-editor"]');
          const pageBox = box('[data-testid="form-builder"]');
          return {
            fields, editor, pageBox,
            scrollWidth: document.documentElement.scrollWidth,
            visibleText: document.querySelector('[data-testid="form-builder"]').innerText,
            moduleCount: document.querySelector('[data-testid="module-select"]').options.length,
            saveDisabled: document.querySelector('[data-testid="save-form"]').disabled,
          };
        });
        const context = `${width}/${language}`;
        assert(result.moduleCount > 0, `No modules: ${context}`);
        assert(result.pageBox.left >= 0 && result.pageBox.right <= width + 1, `Page clipped: ${context}`);
        assert(result.scrollWidth <= width, `Horizontal overflow: ${context}`);
        if (width >= 1024) assert(result.fields.right <= result.editor.left, `Panels overlap: ${context}`);
        else assert(result.fields.top < result.editor.top, `Responsive order failed: ${context}`);
        assert.equal(result.saveDisabled, true, `Pristine form should not save: ${context}`);
        assert(!result.visibleText.includes('estate.'), `Missing translation: ${context}`);
        if (language !== 'en') assert(!result.visibleText.includes('Build and organize multilingual forms'), `Header not translated: ${context}`);
        if (width === 1440 && language === 'fa' || width === 390 && language === 'tr') {
          await page.screenshot({ path: path.join(artifacts, `form-builder-${width}-${language}.png`), fullPage: true });
        }
      }
    }
    await page.setViewport({ width: 1440, height: 1000 });
    await page.click('[data-testid="add-field"]');
    const saveDisabled = await page.$eval('[data-testid="save-form"]', element => element.disabled);
    assert.equal(saveDisabled, false, 'Adding a field must enable save');
    await page.evaluate(() => localStorage.setItem('chakra-ui-color-mode', 'dark'));
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-testid="field-editor"]', { timeout: 30000 });
    await page.screenshot({ path: path.join(artifacts, 'form-builder-dark.png'), fullPage: true });
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log('PASS: form builder, 9 responsive/language states and edit state');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
