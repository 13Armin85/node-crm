// Isolated fixtures only: responsive layouts, real dialogs and PWA lifecycle.
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const puppeteer = require("../server/node_modules/puppeteer");
async function main() {
  const root = path.resolve(
    process.env.CRM_BUILD_ROOT || path.join(__dirname, "../client/build"),
  );
  const artifacts = path.resolve(__dirname, "../layout-artifacts/mobile-pwa");
  fs.mkdirSync(artifacts, { recursive: true });
  const admin = {
    _id: "000000000000000000000001",
    role: "developer",
    firstName: "Mobile",
    lastName: "Tester",
    username: "mobile@example.test",
  };
  const person = {
    _id: "000000000000000000000002",
    role: "user",
    firstName: "Second",
    lastName: "Person",
    username: "second@example.test",
  };
  const records = [admin, person].map((user, index) => ({
    ...user,
    _id: "10000000000000000000000" + index,
    firstName: user.firstName,
    fullName: user.firstName + " " + user.lastName,
    leadName: user.firstName + " " + user.lastName,
    title: "Mobile test record " + index,
    name: "Residence " + index,
    agenda: "Meeting " + index,
    subject: "Email " + index,
    opportunityName: "Opportunity " + index,
    invoiceNumber: "INV-" + index,
    createBy: admin._id,
    assignedToUser: person._id,
    assignedToUserName: "Second Person",
    status: "todo",
    priority: "normal",
    category: "None",
    price: { amount: 1234.5, currency: "TRY" },
    dateTime: "2026-10-20T10:00",
    createdDate: "2026-10-20T12:00:00Z",
    emailsent: 1,
    outboundcall: 1,
    textsent: 0,
    tasks: 1,
    completedTasks: 0,
  }));
  if (process.env.CRM_PAGINATION_CHECK) {
    for (let index = records.length; index < 43; index++) records.push({ ...records[0],
      _id: '1000000000000000' + String(index).padStart(8, '0'),
      fullName: 'Record ' + String(index + 1).padStart(3, '0'), title: 'Record ' + String(index + 1).padStart(3, '0'),
    });
  }
  const logs = [
    {
      _id: "200000000000000000000001",
      actorId: admin._id,
      actorName: "Mobile Tester",
      actorUsername: admin.username,
      action: "update",
      operation: "update",
      collection: "Properties",
      recordLabel: "Mobile property",
      createdAt: "2026-10-20T12:00:00Z",
      recordCount: 1,
    },
  ];
  if (process.env.CRM_PAGINATION_CHECK) {
    for (let index = logs.length; index < 43; index++) logs.push({ ...logs[0], _id: '2000000000000000' + String(index).padStart(8, '0'), recordLabel: 'Property ' + (index + 1) });
  }
  const field = (name, type = "text", label = name) => ({
    name,
    type,
    label: { en: label, fa: label, tr: label },
    kind: "SYSTEM_FIELD",
    enabled: true,
    isView: true,
    isTableField: true,
  });
  const definition = (moduleName) => ({
    moduleName,
    fields: [
      field(
        moduleName === "Properties"
          ? "title"
          : moduleName === "Residences"
            ? "name"
            : moduleName === "Leads"
              ? "leadName"
              : "fullName",
        "text",
        "Name",
      ),
      field("description", "textarea", "Description"),
      field("phoneNumber", "phone", "Phone"),
      field("email", "email", "Email"),
    ],
  });
  const fixture = (url) => {
    const route = decodeURIComponent(url.pathname).replace(/\/$/, "");
    if (route === "/api/user") return { user: [admin, person] };
    if (route.startsWith("/api/user/view/")) return admin;
    if (route === "/api/notification")
      return { notifications: [], unreadCount: 0, hasMore: false };
    if (route.startsWith("/api/visibility"))
      return {
        users: [admin, person],
        visibility: {},
        accessibleModules: [
          "Contacts",
          "Leads",
          "Tasks",
          "Properties",
          "Documents",
          "Meetings",
          "Calls",
          "Emails",
          "Invoices",
          "Residences",
          "Partner Customers",
        ],
      };
    if (route === "/api/audit-logs")
      return {
        items: process.env.CRM_PAGINATION_CHECK ? logs.slice((Number(url.searchParams.get('page') || 1) - 1) * Number(url.searchParams.get('limit') || 25), Number(url.searchParams.get('page') || 1) * Number(url.searchParams.get('limit') || 25)) : logs,
        total: logs.length,
        actors: [{ _id: admin._id, name: "Mobile Tester" }],
        collections: ["Properties"],
        summary: { create: 0, update: 1, delete: 0 },
      };
    if (route === "/api/estate/definitions")
      return ["Properties", "Contacts", "Leads"];
    if (route.startsWith("/api/estate/definitions/"))
      return definition(route.split("/").pop());
    if (route.endsWith("/options"))
      return [{ value: person._id, label: "Second Person" }];
    if (route === "/api/custom-field")
      return [
        {
          _id: "300000000000000000000001",
          moduleName: url.searchParams.get("moduleName") || "Contacts",
          fields: [
            field("fullName", "text", "Name"),
            field("phoneNumber", "phone", "Phone"),
            ...(process.env.CRM_MODAL_CHECK ? Array.from({ length: 8 }, (_, index) => field('extra' + index, 'text', 'Additional search field ' + (index + 1))) : []),
          ],
        },
      ];
    if (route === "/api/task/assignees") return [admin, person];
    if (route === "/api/estate/dashboard/sales-summary")
      return {
        sold: { count: 1, values: [{ currency: "TRY", amount: 5000 }] },
        available: { count: 2, values: [] },
        bySeller: [{ userId: admin._id, name: "Mobile Tester", soldCount: 1, values: [{ currency: "TRY", amount: 5000 }] }],
      };
    if (
      [
        "/api/estate/Properties",
        "/api/estate/Residences",
        "/api/estate/Partner Customers",
      ].includes(route)
    )
      return { items: process.env.CRM_PAGINATION_CHECK ? records.slice((Number(url.searchParams.get('page') || 1) - 1) * Number(url.searchParams.get('limit') || 20), Number(url.searchParams.get('page') || 1) * Number(url.searchParams.get('limit') || 20)) : records, total: records.length };
    if (route === "/api/reporting/line-chart")
      return [
        { name: "Tasks", length: 2 },
        { name: "Leads", length: 2 },
        { name: "Properties", length: 2 },
      ];
    if (route === "/api/reporting/index")
      return {
        Email: [{ Emails: [{ date: "2026-10-20", Emailcount: 2 }] }],
        Call: [{ Calls: [{ date: "2026-10-20", Callcount: 1 }] }],
      };
    if (route === "/api/status")
      return { data: { leadData: records, taskData: records } };
    if (route === "/api/document")
      return [
        {
          _id: "400000000000000000000001",
          isRoot: true,
          files: [
            {
              _id: "400000000000000000000002",
              fileName: "Contract.pdf",
              mimeType: "application/pdf",
              size: 2048,
              category: "GENERAL",
              createdAt: "2026-10-20T12:00:00Z",
            },
          ],
        },
      ];
    if (route === "/api/calendar")
      return [
        {
          id: "calendar1",
          title: "Meeting",
          start: "2026-10-20T10:00:00",
          end: "2026-10-20T11:00:00",
          groupId: "meeting",
        },
      ];
    if (
      [
        "/api/task",
        "/api/contact",
        "/api/lead",
        "/api/invoices",
        "/api/opportunity",
        "/api/meeting",
        "/api/phoneCall",
        "/api/email",
        "/api/email-temp",
        "/api/reporting",
      ].includes(route)
    )
      return records;
    return [];
  };
  let workerVersion = 0;
  let offlineServer = false;
  const server = http.createServer((req, res) => {
    if (offlineServer) {
      req.socket.destroy();
      return;
    }
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(fixture(url)));
      return;
    }
    let file = path.resolve(root, "." + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep)) file = path.join(root, "index.html");
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      if (
        url.pathname.startsWith("/static/") ||
        /\.(js|png|json|html)$/.test(url.pathname)
      ) {
        res.writeHead(404).end();
        return;
      }
      file = path.join(root, "index.html");
    }
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".json": "application/json",
        ".woff2": "font/woff2",
      }[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/service-worker.js" && workerVersion) {
      res.end(
        fs
          .readFileSync(file, "utf8")
          .replace(
            /crm-pwa-[a-f0-9]+/,
            "crm-pwa-browser-update-" + workerVersion,
          ),
      );
      return;
    }
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser, page;
  const requests = [];
  const errors = [],
    measurements = [];
  try {
    browser = await puppeteer.launch({
      executablePath:
        process.env.CHROME_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      headless: true,
      pipe: true,
    });
    page = await browser.newPage();
    page.on("pageerror", (error) =>
      errors.push({
        route: new URL(page.url()).pathname,
        error: error.message,
      }),
    );
    const origin = "http://127.0.0.1:" + server.address().port;
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      requests.push(req.url());
      if (new URL(req.url()).origin !== origin) req.abort().catch(() => {});
      else req.continue().catch(() => {});
    });
    const token =
      Buffer.from("{}").toString("base64url") +
      "." +
      Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 7200 }),
      ).toString("base64url") +
      ".fixture";
    const session = async (role, language) => {
      await page.goto(origin + "/auth", { waitUntil: "domcontentloaded" });
      await page.evaluate(
        (admin, token, role, language) => {
          localStorage.clear();
          sessionStorage.clear();
          localStorage.setItem("user", JSON.stringify({ ...admin, role }));
          sessionStorage.setItem("token", token);
          localStorage.setItem("crm-language", language);
        },
        admin,
        token,
        role,
        language,
      );
    };
    const goto = async (route) => {
      await page.goto(origin + route, { waitUntil: "networkidle2" });
      await page.waitForSelector(".crm-content");
      if (process.env.CRM_MODAL_CSS) await page.addStyleTag({ content: fs.readFileSync(path.resolve(__dirname, '../client/src/assets/css/App.css'), 'utf8').replace(/@import[^;]+;/g, '') });
    };
    const geometry = () =>
      page.evaluate(() => {
        const visible = (node) =>
          node.getClientRects().length &&
          getComputedStyle(node).visibility !== "hidden";
        const overflow = [...document.querySelectorAll(".crm-content *")]
          .filter(visible)
          .filter((node) => {
            const r = node.getBoundingClientRect();
            if (r.left >= -1 && r.right <= innerWidth + 1) return false;
            for (
              let parent = node.parentElement;
              parent && parent !== document.body;
              parent = parent.parentElement
            ) {
              const style = getComputedStyle(parent);
              if (
                (/auto|scroll/.test(style.overflowX) ||
                  (!node.matches("button,input,select,textarea,a[href]") &&
                    /hidden|clip/.test(style.overflowX))) &&
                parent.scrollWidth > parent.clientWidth + 1
              )
                return false;
            }
            return true;
          })
          .slice(0, 10)
          .map((node) => ({
            tag: node.tagName,
            class: node.className,
            text: node.textContent.slice(0, 60),
            left: Math.round(node.getBoundingClientRect().left),
            right: Math.round(node.getBoundingClientRect().right),
          }));
        return {
          width: innerWidth,
          pageWidth: document.documentElement.scrollWidth,
          overflow,
        };
      });
    if (process.env.CRM_COMPACT_RECORD_CHECK) {
      const fitRecord = async name => {
        await page.waitForSelector('.crm-record-form', { visible: true });
        await page.waitForFunction(() => {
          const node = document.querySelector('.crm-record-form'); if (!node) return false;
          const r = node.getBoundingClientRect();
          return Number(getComputedStyle(node).opacity) > .99 && r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1 && Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 2;
        });
        const state = await page.$eval('.crm-record-form', node => {
          const box = node.getBoundingClientRect(), body = node.querySelector('.chakra-modal__body');
          const header = node.querySelector('.chakra-modal__header');
          const visible = item => item.getClientRects().length && getComputedStyle(item).visibility !== 'hidden';
          return { headerOverflow: header && getComputedStyle(header).overflowY, headerScroll: header && header.scrollHeight - header.clientHeight,
            width: box.width, height: box.height, bodyHeight: body.clientHeight, bodyWidth: body.clientWidth, scrollWidth: body.scrollWidth,
            controls: [...node.querySelectorAll('.chakra-modal__footer button, .chakra-modal__header button, .chakra-modal__close-btn')].filter(visible).map(button => {
              const r = button.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
            }), left: box.left, right: box.right, top: box.top, bottom: box.bottom, available: innerHeight };
        });
        assert(state.width <= 501, 'Record form must use the compact width: ' + name + JSON.stringify(state));
        assert(state.height <= Math.min(541, state.available * .76 + 1), 'Record form must use the compact height: ' + name + JSON.stringify(state));
        assert(!['auto', 'scroll'].includes(state.headerOverflow) && state.headerScroll <= 1, 'Form headers must not scroll: ' + name + JSON.stringify(state));
        assert(state.bodyHeight > 0 && state.scrollWidth <= state.bodyWidth + 1, 'Record form body must fit and scroll vertically: ' + name + JSON.stringify(state));
        for (const control of state.controls) assert(control.left >= state.left - 1 && control.right <= state.right + 1 && control.top >= state.top - 1 && control.bottom <= state.bottom + 1, 'Record controls must stay visible: ' + name + JSON.stringify(state));
        const before = await page.$eval('.crm-record-form .chakra-modal__footer', node => node.getBoundingClientRect().top);
        await page.$eval('.crm-record-form .chakra-modal__body', node => { node.scrollTop = node.scrollHeight; });
        assert.equal(Math.round(await page.$eval('.crm-record-form .chakra-modal__footer', node => node.getBoundingClientRect().top)), Math.round(before), 'Scrolling fields must keep the footer visible');
      };
      const close = async () => {
        const button = await page.$('.crm-record-form .chakra-modal__close-btn') || await page.$('.crm-record-form .chakra-modal__header button');
        if (button) await button.click(); else {
          const buttons = await page.$$('.crm-record-form .chakra-modal__footer button');
          assert(buttons.length > 0, 'A creation form needs a close control');
          await buttons[buttons.length - 1].click();
        }
        await page.waitForSelector('.crm-record-form', { hidden: true });
      };
      for (const [width, height, language] of [[320, 740, 'fa'], [390, 844, 'en'], [844, 390, 'en'], [1366, 900, 'en']]) {
        await page.setViewport({ width, height, isMobile: width < 1000, hasTouch: width < 1000 });
        await session('developer', language);
        for (const route of ['/contacts', '/lead', '/properties', '/residences', '/partner-customers', '/user', '/metting', '/phone-call', '/email']) {
          await goto(route);
          await page.click('.crm-page-hero button');
          await fitRecord(route + ' ' + width);
          if (['/contacts', '/properties', '/user'].includes(route) && [320, 1366].includes(width)) await page.screenshot({ path: path.join(artifacts, 'compact-create-' + route.slice(1) + '-' + width + '.png') });
          await close();
          console.log('PASS: compact centered creation form, body scroll and accessible actions ' + route + ' ' + width);
        }
        await goto('/task');
        const taskButtons = await page.$$('.crm-task-page-hero button');
        await taskButtons[taskButtons.length - 1].click();
        await fitRecord('task ' + width); await close();
        await goto('/documents');
        const create = await page.$$('.crm-document-heading button');
        assert(create.length >= 2, 'New folder and upload controls should be available in the fixture');
        {
          for (let index = 0; index < 2; index++) {
            const buttons = await page.$$('.crm-document-heading button'); await buttons[index].click();
            await fitRecord('documents ' + index + ' ' + width); await close();
          }
        }
        console.log('PASS: compact task and document dialogs ' + width + ' ' + language);
      }
      assert.deepEqual(errors, [], 'Runtime errors'); return;
    }
    if (process.env.CRM_COMPACT_FILTER_CHECK) {
      const waitModal = async () => {
        await page.waitForSelector('.crm-advanced-search', { visible: true });
        await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.crm-advanced-search')).opacity) > .99);
      };
      const fit = async (name, compact = false) => {
        await waitModal();
        const result = await page.$eval('.crm-advanced-search', node => {
          const r = node.getBoundingClientRect(), body = node.querySelector('.chakra-modal__body');
          return { width: r.width, height: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom, inner: body.clientWidth, scroll: body.scrollWidth, viewport: innerWidth, visible: innerHeight,
            buttons: [...node.querySelectorAll('.chakra-modal__footer button')].map(button => { const b = button.getBoundingClientRect(); return { bottom: b.bottom, right: b.right, left: b.left }; }) };
        });
        assert(result.width <= 501 && result.left >= 0 && result.right <= result.viewport + 1 && result.top >= 0 && result.bottom <= result.visible + 1, 'Compact filter bounds: ' + name + JSON.stringify(result));
        assert(result.height <= Math.min(541, result.visible * .76 + 1), 'Filter should occupy only part of the screen');
        if (compact) assert(result.height < 370, 'Default filters should be short: ' + name + JSON.stringify(result));
        assert(result.scroll <= result.inner + 1, 'Filter fields should not overflow horizontally');
        assert(result.buttons.every(button => button.bottom <= result.bottom + 1 && button.right <= result.right + 1 && button.left >= result.left - 1), 'Filter actions must stay inside the panel');
      };
      for (const [width, height, language] of [[320, 740, 'fa'], [390, 844, 'en'], [768, 1024, 'tr'], [844, 390, 'en'], [1366, 900, 'en']]) {
        await page.setViewport({ width, height, isMobile: width < 1000, hasTouch: width < 1000 });
        await session('developer', language); await goto('/contacts');
        await page.click('.crm-table-toolbar__main > button');
        await fit('default ' + width, true);
        assert(await page.$eval('#crm-filter-date-fields', node => node.hidden));
        await page.screenshot({ path: path.join(artifacts, 'compact-filter-' + width + '.png') });
        await page.type('.crm-advanced-search input[name="fullName"]', 'Mobile');
        await page.click('.crm-filter-dates__toggle');
        await fit('date filters ' + width);
        await page.$eval('input[name="fromcreatedDate"]', node => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, '2026-10-19');
          node.dispatchEvent(new Event('input', { bubbles: true }));
          node.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await page.click('.crm-filter-dates__toggle');
        await page.click('.crm-advanced-search button[type="submit"]');
        await page.waitForSelector('.crm-advanced-search', { hidden: true });
        assert.equal(await page.$$eval('.crm-record-row', nodes => nodes.length), 1);
        assert((await page.$eval('.crm-record-row', node => node.textContent)).includes('Mobile Tester'));
        await goto('/contacts'); await page.click('.crm-table-toolbar__main > button');
        assert(await page.$eval('#crm-filter-date-fields', node => node.hidden));
        await page.type('.crm-advanced-search input[name="fullName"]', 'Second');
        await page.keyboard.press('Enter');
        await page.waitForSelector('.crm-advanced-search', { hidden: true });
        assert((await page.$eval('.crm-record-row', node => node.textContent)).includes('Second Person'));
        console.log('PASS: compact dimensions, date toggle, saved criteria and Enter ' + width + ' ' + language);
      }
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await session('developer', 'en');
      for (const route of ['/user', '/task', '/phone-call']) {
        await goto(route);
        const selector = route === '/task' ? '.crm-task-searchbar button' : '.crm-table-toolbar__main > button';
        await page.click(selector); await fit('legacy ' + route);
        await page.click('.crm-advanced-search .chakra-modal__close-btn');
        await page.waitForSelector('.crm-advanced-search', { hidden: true });
        console.log('PASS: compact shared styling ' + route);
      }
      assert.deepEqual(errors, [], 'Runtime errors'); return;
    }
    if (process.env.CRM_MODAL_CHECK) {
      const artifactsPrefix = path.join(artifacts, 'dialog');
      const waitDialog = async () => {
        await page.waitForSelector('.chakra-modal__content', { visible: true });
        await page.waitForFunction(() => {
          const node = document.querySelector('.chakra-modal__content');
          if (!node) return false;
          const r = node.getBoundingClientRect(), v = window.visualViewport;
          return Number(getComputedStyle(node).opacity) > .99 && r.top >= (v?.offsetTop || 0) - 1 && r.bottom <= (v?.offsetTop || 0) + (v?.height || innerHeight) + 1 && r.left >= (v?.offsetLeft || 0) - 1 && r.right <= (v?.offsetLeft || 0) + (v?.width || innerWidth) + 1;
        });
      };
      const bounds = async name => {
        await waitDialog();
        const state = await page.evaluate(() => {
          const dialog = document.querySelector('.chakra-modal__content');
          const rect = node => { const r = node.getBoundingClientRect(); return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, height: r.height }; };
          const body = dialog.querySelector('.chakra-modal__body'), footer = dialog.querySelector('.chakra-modal__footer');
          const header = dialog.querySelector('.chakra-modal__header'), close = dialog.querySelector('.chakra-modal__close-btn');
          const range = document.createRange(); if (header) range.selectNodeContents(header);
          const title = header ? rect({ getBoundingClientRect: () => range.getBoundingClientRect() }) : null;
          return { title, close: close ? rect(close) : null, box: rect(dialog), body: rect(body), bodyWidth: body.clientWidth, bodyScroll: body.scrollWidth, scrollable: body.scrollHeight > body.clientHeight,
            footer: footer ? rect(footer) : null,
            controls: [...dialog.querySelectorAll('.chakra-modal__footer button, .chakra-modal__close-btn')].filter(node => node.getClientRects().length).map(rect),
          };
        });
        if (state.close && state.title) assert(state.close.right <= state.title.left || state.close.left >= state.title.right || state.close.bottom <= state.title.top || state.close.top >= state.title.bottom, 'Close button should not overlap the title: ' + name + JSON.stringify(state));
        assert(state.body.height > 0, 'Dialog body must have room: ' + name);
        assert(state.bodyScroll <= state.bodyWidth + 1, 'Dialog should not scroll horizontally: ' + name + JSON.stringify(state));
        for (const r of state.controls) assert(r.top >= state.box.top - 1 && r.bottom <= state.box.bottom + 1 && r.left >= state.box.left - 1 && r.right <= state.box.right + 1, 'Dialog controls must remain visible: ' + name + JSON.stringify(state));
        const footerBefore = state.footer?.top;
        await page.$eval('.chakra-modal__body', node => { node.scrollTop = node.scrollHeight; });
        if (footerBefore != null) assert.equal(Math.round(await page.$eval('.chakra-modal__footer', node => node.getBoundingClientRect().top)), Math.round(footerBefore), 'Footer should remain in place while the body scrolls');
        return state;
      };
      const close = async () => { const button = await page.$('.chakra-modal__close-btn') || await page.$('.chakra-modal__header button'); if (button) await button.click(); else await page.keyboard.press('Escape'); await page.waitForSelector('.chakra-modal__content', { hidden: true }); };
      const menuItem = async (selector, label) => {
        await page.waitForFunction(selector => [...document.querySelectorAll(selector)].some(node => node.getClientRects().length && getComputedStyle(node.closest('[role="menu"]')).opacity === '1'), {}, selector);
        for (const item of await page.$$(selector)) if (await item.evaluate((node, label) => node.textContent.trim() === label && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden', label)) { await item.evaluate(node => node.click()); return; }
        throw new Error('Menu item missing: ' + label);
      };
      if (!process.env.CRM_MODAL_FORMS_ONLY) {
      for (const [width, height, language] of [[320, 740, 'fa'], [390, 844, 'en'], [768, 1024, 'tr'], [844, 390, 'en'], [1366, 700, 'en']]) {
        await page.setViewport({ width, height, isMobile: width < 1000, hasTouch: width < 1000 });
        await session('developer', language);
        await goto('/contacts');
        await page.click('.crm-table-toolbar__main > button');
        const state = await bounds('advanced search ' + width);
        if (width < 768 || height < 500) assert(state.scrollable, 'Many search fields need an internal scrollbar');
        await page.$eval('.crm-advanced-search input[name="fullName"]', node => node.focus());
        await page.type('.crm-advanced-search input[name="fullName"]', 'Mobile');
        await page.click('.crm-advanced-search .chakra-modal__footer button:last-child');
        assert.equal(await page.$eval('.crm-advanced-search input[name="fullName"]', node => node.value), '', 'Clear should still clear search fields');
        await page.screenshot({ path: artifactsPrefix + '-search-' + width + '.png' });
        await close();
        await page.click('.crm-page-help');
        await bounds('page help ' + width);
        await close();
        console.log('PASS: advanced search and help bounds, scrolling, clear and close ' + width + ' ' + language);
      }
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await session('developer', 'en');
      await goto('/contacts');
      await page.click('.crm-table-toolbar__main > button');
      await waitDialog();
      await page.evaluate(() => {
        window.__crmViewportDescriptors = ['height', 'offsetTop'].map(name => [name, Object.getOwnPropertyDescriptor(visualViewport, name)]);
        Object.defineProperty(visualViewport, 'height', { configurable: true, value: 300 });
        Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 120 });
        visualViewport.dispatchEvent(new Event('resize'));
        visualViewport.dispatchEvent(new Event('scroll'));
      });
      await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--crm-dialog-height') === '300px');
      await bounds('visual viewport keyboard and scroll offset');
      await page.evaluate(() => {
        for (const [name, descriptor] of window.__crmViewportDescriptors) if (descriptor) Object.defineProperty(visualViewport, name, descriptor); else delete visualViewport[name];
        visualViewport.dispatchEvent(new Event('resize'));
      });
      await close();
      const device = await page.createCDPSession();
      await device.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34 } });
      await page.click('.crm-table-toolbar__main > button');
      const cutout = await bounds('phone cutouts');
      assert(cutout.box.top >= 47 && cutout.box.bottom <= 810, 'Dialog must avoid cutouts and the home indicator');
      await close();
      await device.send('Emulation.setSafeAreaInsetsOverride', { insets: {} });
      console.log('PASS: visual-only keyboard resize, scroll offset and phone safe areas');
      }
      for (const [width, height] of [[320, 740], [844, 390], [1366, 700]]) {
        await page.setViewport({ width, height, isMobile: width < 1000, hasTouch: width < 1000 });
        await session('developer', 'en');
        await goto('/contacts');
        await page.click('.crm-list-page-hero__actions button');
        await bounds('add contact drawer ' + width); await close();
        for (const label of ['Manage Columns', 'Import']) {
          await page.click('.crm-table-settings');
          await menuItem('.crm-table-tools-menu [role="menuitem"]', label);
          await bounds(label + ' ' + width); await close();
        }
        await page.click('.crm-record-menu-button');
        await menuItem('[role="menuitem"]', 'Delete');
        await bounds('delete confirmation ' + width); await close();
        for (const route of ['/properties', '/residences', '/user']) {
          await goto(route);
          await page.click('.crm-page-hero button');
          await bounds('record form ' + route + ' ' + width); await close();
        }
        await goto('/task');
        for (const button of await page.$$('.crm-task-page-hero button')) if ((await button.evaluate(node => node.textContent)).includes('New Task')) { await button.click(); break; }
        await bounds('new task ' + width); await close();
        await page.click('.crm-profile-button');
        await menuItem('.crm-profile-menu [role="menuitem"]', 'Change Password');
        await bounds('nested password form ' + width); await close();
        await page.screenshot({ path: artifactsPrefix + '-closed-' + width + '.png' });
        console.log('PASS: contact drawer, columns, import, delete, estate/user/task and password dialogs ' + width);
      }
      assert.deepEqual(errors, [], 'Runtime errors');
      return;
    }
    const routes = [
      "/default",
      "/properties",
      "/partner-customers",
      "/residences",
      "/contacts",
      "/lead",
      "/task",
      "/documents",
      "/calender",
      "/user",
      "/admin-setting",
      "/audit-logs",
      "/form-builder",
      "/reporting-analytics",
      "/invoices",
      "/opportunities",
      "/metting",
      "/phone-call",
      "/email",
      "/email-template",
    ];
    for (const [width, height, language, role] of [
      [320, 740, "fa", "developer"],
      [390, 844, "en", "admin"],
      [430, 932, "tr", "user"],
      [844, 390, "fa", "admin"],
    ]) {
      await page.setViewport({ width, height, isMobile: true, hasTouch: true });
      await session(role, language);
      for (const route of process.env.CRM_MOBILE_FOCUSED
        ? []
        : process.env.CRM_MOBILE_ROUTE
          ? [process.env.CRM_MOBILE_ROUTE]
          : routes) {
        if (
          role === "user" &&
          ["/user", "/admin-setting", "/form-builder"].includes(route)
        )
          continue;
        await goto(route);
        if (route === "/task" && width < 480) {
          assert.equal(
            await page.$eval(
              ".crm-kanban-board",
              (node) =>
                getComputedStyle(node).gridTemplateColumns.split(" ").length,
            ),
            1,
            "Phone tasks need readable single-column cards",
          );
        }
        if (width < 768) {
          const cards = await page.evaluate(() => [...document.querySelectorAll('.crm-mobile-records')].map(table => ({
            width: table.getBoundingClientRect().width,
            scrollWidth: table.scrollWidth,
            rows: [...table.querySelectorAll('.crm-record-row')].map(row => ({
              display: getComputedStyle(row).display,
              labels: [...row.querySelectorAll('td:not([hidden])')].every(cell => Boolean(cell.dataset.label)),
              controls: [...row.querySelectorAll('button')].filter(button => button.getClientRects().length).every(button => button.getBoundingClientRect().height >= 43),
            })),
          })));
          for (const card of cards) {
            assert(card.scrollWidth <= card.width + 1, 'Record cards must fit without horizontal scrolling: ' + route);
            for (const row of card.rows) {
              assert.equal(row.display, 'grid', 'Phone rows should be cards: ' + route);
              assert(row.labels, 'Every card field needs a readable label: ' + route);
              assert(row.controls, 'Card actions need comfortable touch targets: ' + route);
            }
          }
          if (route === '/default') {
            const headers = await page.$$eval('.crm-dashboard-card-header__title', nodes => nodes.map(node => parseFloat(getComputedStyle(node).fontSize)));
            assert(headers.length > 0 && headers.every(size => size >= 16 && size <= 18), 'Phone dashboard titles should stay compact and readable');
            const clipped = await page.$$eval('.crm-dashboard-card-header', headers => headers.flatMap(header => {
              const bounds = header.getBoundingClientRect();
              return [...header.querySelectorAll('button, a, select')].filter(node => {
                const r = node.getBoundingClientRect();
                return r.top < bounds.top || r.bottom > bounds.bottom || r.left < bounds.left || r.right > bounds.right;
              }).map(node => node.getAttribute('aria-label') || node.textContent);
            }));
            assert.deepEqual(clipped, [], 'Dashboard header actions must remain fully visible');
          }
        }
        const result = { route, language, role, ...(await geometry()) };
        measurements.push(result);
        if (result.pageWidth > width + 1 || result.overflow.length)
          console.log("OVERFLOW " + JSON.stringify(result));
        if (!process.env.CRM_MOBILE_AUDIT_ONLY)
          assert(
            result.pageWidth <= width + 1 && result.overflow.length === 0,
            "Overflow: " + JSON.stringify(result),
          );
        if (
          ["/default", "/properties", "/residences", "/contacts", "/user", "/task", "/audit-logs"].includes(route) &&
          width === 320
        ) {
          await page.screenshot({ path: path.join(artifacts, route.slice(1) + "-" + width + ".png") });
          const table = await page.$('.crm-mobile-records');
          if (table) await table.screenshot({ path: path.join(artifacts, route.slice(1) + '-cards-320.png') });
          if (route === '/default') {
            const header = await page.$('.crm-dashboard-card-header:has(button)') || await page.$('.crm-dashboard-card-header');
            if (header) await header.screenshot({ path: path.join(artifacts, 'dashboard-header-320.png') });
          }
        }
      }
      if (!process.env.CRM_MOBILE_FOCUSED)
        console.log(
          "PASS: mobile routes " +
            width +
            "x" +
            height +
            " " +
            language +
            " " +
            role,
        );
    }
    if (!process.env.CRM_MOBILE_FOCUSED)
      fs.writeFileSync(
        path.join(
          artifacts,
          process.env.CRM_MOBILE_ROUTE
            ? "route-measurements.json"
            : "measurements.json",
        ),
        JSON.stringify(measurements, null, 2),
      );
    if (process.env.CRM_MOBILE_AUDIT_ONLY) {
      console.log("Runtime errors: " + JSON.stringify(errors));
      return;
    }
    if (process.env.CRM_PAGINATION_CHECK) {
      await session('developer', 'en');
      for (const [width, height] of [[320, 740], [390, 844], [844, 390], [1366, 900]]) {
        await page.setViewport({ width, height, isMobile: width < 1000, hasTouch: width < 1000 });
        for (const [route, expectedCount] of [['/contacts', 5], ['/properties', 20], ['/audit-logs', 25]]) {
          await goto(route);
          const pager = '.crm-record-pagination';
          await page.waitForSelector(pager);
          const rows = route === '/audit-logs' ? (width < 960 ? '.crm-audit-mobile-event' : '.crm-audit-table tbody tr') : '.crm-record-row';
          assert.equal(await page.$$eval(rows, nodes => nodes.length), expectedCount);
          const first = await page.$eval(rows, node => node.textContent);
          await page.click(pager + ' button[aria-label="Next Page"]');
          await page.waitForFunction((selector, previous) => document.querySelector(selector)?.textContent !== previous, {}, rows, first);
          assert.equal(await page.$eval(pager + ' [aria-current="page"]', node => node.textContent), '2');
          await page.select(pager + ' select', '5');
          await page.waitForFunction(selector => document.querySelector(selector + ' [aria-current="page"]')?.textContent === '1', {}, pager);
          await page.waitForFunction(selector => document.querySelectorAll(selector).length === 5, {}, rows);
          if (route === '/contacts' && width < 768) {
            const actions = await page.$('.crm-record-menu-button');
            assert(actions, 'The record action button should have a stable class');
            assert((await actions.evaluate(node => node.textContent)).includes('Actions'));
            const bounds = await actions.boundingBox();
            assert(bounds.width >= 90 && bounds.height >= 44, 'Actions need a readable touch target');
            await actions.click();
            await page.waitForFunction(() => [...document.querySelectorAll('[role="menu"]')].some(node => node.getBoundingClientRect().width > 0 && getComputedStyle(node).visibility !== 'hidden' && Number(getComputedStyle(node).opacity) > .99));
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => [...document.querySelectorAll('[role="menu"]')].every(node => !node.getClientRects().length || getComputedStyle(node).visibility === 'hidden'));
          }
          const jump = await page.$(pager + ' input');
          assert(jump, 'Many pages need a direct page entry');
          await jump.click({ clickCount: 3 });
          await page.keyboard.type('9');
          await page.keyboard.press('Enter');
          await page.waitForFunction(selector => document.querySelector(selector + ' [aria-current="page"]')?.textContent === '9', {}, pager);
          await page.waitForFunction(selector => document.querySelectorAll(selector).length === 3, {}, rows);
          assert(await page.$eval(pager + ' button[aria-label="Next Page"]', node => node.disabled));
          const result = await geometry();
          assert(result.pageWidth <= width + 1 && result.overflow.length === 0, 'Pagination overflow: ' + route + JSON.stringify(result));
          await page.$eval(pager, node => node.scrollIntoView({ block: 'center' }));
          const nav = await page.$(pager);
          await nav.screenshot({ path: path.join(artifacts, route.slice(1) + '-pagination-' + width + '.png') });
          console.log('PASS: card pagination, page size, direct entry and final page ' + route + ' ' + width);
        }
      }
      assert.deepEqual(errors, [], 'Runtime errors');
      return;
    }
    // Exercise the same controls after table rows become mobile cards.
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await session('developer', 'en');
    await goto('/contacts');
    await page.waitForSelector('.crm-record-row');
    const firstName = () => page.$eval('.crm-record-row [data-mobile-role="primary"]', node => node.textContent);
    assert((await firstName()).includes('Mobile Tester'));
    await page.select('.crm-mobile-table-sort select', JSON.stringify(['fullName', true]));
    assert((await firstName()).includes('Second Person'), 'Mobile sorting must reorder the cards');
    await page.select('.crm-mobile-table-sort select', '');
    const selected = await page.$('.crm-record-row input[type="checkbox"]');
    assert(selected, 'Mobile row selection should remain available');
    await selected.click();
    await page.waitForSelector('.crm-record-row[aria-selected="true"]');
    const rowMenu = await page.$('.crm-record-row [data-mobile-role="actions"] button');
    assert(rowMenu, 'Card actions should remain available');
    await rowMenu.click();
    await page.waitForFunction(() => [...document.querySelectorAll('[role="menu"]')].some(node => node.getBoundingClientRect().width > 0 && getComputedStyle(node).visibility !== 'hidden' && Number(getComputedStyle(node).opacity) > .99));
    assert((await page.$$eval('[role="menuitem"]', nodes => nodes.map(node => node.textContent))).some(text => text.includes('Edit')));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => [...document.querySelectorAll('[role="menu"]')].every(node => !node.getClientRects().length || getComputedStyle(node).visibility === 'hidden'));
    const hideColumn = async label => {
      await page.click('.crm-table-settings');
      await page.waitForFunction(() => [...document.querySelectorAll('.crm-table-tools-menu')].some(node => getComputedStyle(node).opacity === '1'));
      const items = await page.$$('.crm-table-tools-menu [role="menuitem"]');
      for (const item of items) if ((await item.evaluate(node => node.textContent)).includes('Manage Columns')) { await item.click(); break; }
      await page.waitForSelector('.crm-columns-modal', { visible: true });
      await page.waitForFunction(() => {
        const box = document.querySelector('.crm-columns-modal').getBoundingClientRect();
        return box.left >= 0 && box.right <= innerWidth;
      });
      for (const checkbox of await page.$$('.crm-columns-modal .chakra-checkbox')) {
        if ((await checkbox.evaluate(node => node.textContent.trim())) === label) { await checkbox.click(); break; }
      }
      for (const button of await page.$$('.crm-columns-modal button')) {
        if ((await button.evaluate(node => node.textContent.trim())) === 'Save') { await button.click(); break; }
      }
      await page.waitForSelector('.crm-columns-modal', { hidden: true });
    };
    assert(await page.$('.crm-record-row td[data-label="Phone"]'), 'Managed form fields need readable labels');
    await hideColumn('Phone');
    assert.equal(await page.$$eval('.crm-record-row:first-child td[data-label="Phone"]', nodes => nodes.filter(node => node.getClientRects().length).length), 0, 'Shared card fields must respect column preferences');
    await goto('/properties');
    await hideColumn('Price');
    assert.equal(await page.$$eval('.crm-record-row:first-child td[data-label="Price"]', nodes => nodes.filter(node => node.getClientRects().length).length), 0, 'Property card fields must respect column preferences');
    await page.evaluate(() => localStorage.setItem('chakra-ui-color-mode', 'dark'));
    await goto('/residences');
    assert(await page.$('body.chakra-ui-dark'), 'Check the dark mobile theme');
    assert.equal((await geometry()).overflow.length, 0, 'Dark cards should fit the phone');
    await page.screenshot({ path: path.join(artifacts, 'residences-dark-390.png') });
    await page.evaluate(() => localStorage.setItem('chakra-ui-color-mode', 'light'));
    await page.setViewport({ width: 1366, height: 900, isMobile: false, hasTouch: false });
    for (const route of ['/contacts', '/properties', '/default']) {
      await goto(route);
      assert.equal(await page.$eval('.crm-mobile-records', node => getComputedStyle(node).display), 'table', 'Desktop should keep the table layout: ' + route);
      assert.equal(await page.$eval('.crm-record-row', node => getComputedStyle(node).display), 'table-row', 'Desktop rows should retain their original layout');
    }
    await page.screenshot({ path: path.join(artifacts, 'dashboard-desktop-1366.png') });
    console.log('PASS: phone sorting, selection, row menu, column preferences, dark cards and desktop tables');
    const device = await page.createCDPSession();
    for (const screen of [
      { width: 390, height: 844, top: 47, bottom: 34, left: 0, right: 0 },
      { width: 844, height: 390, top: 0, bottom: 21, left: 44, right: 44 },
    ]) {
      const { width, height, top, bottom, left, right } = screen;
      await page.setViewport({ width, height, isMobile: true, hasTouch: true });
      await device.send("Emulation.setSafeAreaInsetsOverride", {
        insets: { top, bottom, left, right },
      });
      await goto("/task");
      const header = await page.$eval(".crm-header", (node) => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top };
      });
      assert(
        header.left >= left &&
          header.right <= width - right &&
          header.top >= top,
        "Header must avoid phone cutouts: " + JSON.stringify(header),
      );
      await page.click(".crm-sidebar-toggle");
      await page.waitForSelector('.crm-shell[data-sidebar-open="true"]');
      const sidebar = await page.$eval(".crm-sidebar-shell", (node) => {
        const r = node.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      });
      assert(
        sidebar.top >= top && sidebar.bottom <= height - bottom + 1,
        "Navigation must remain inside phone safe areas",
      );
      await page.keyboard.press("Escape");
      await page.screenshot({
        path: path.join(artifacts, "safe-area-" + width + ".png"),
      });
    }
    await device.send("Emulation.setSafeAreaInsetsOverride", { insets: {} });
    console.log(
      "PASS: portrait and landscape phone cutouts, home indicator and navigation bounds",
    );
    await page.setViewport({ width: 390, height: 844 });
    await session("developer", "en");
    await goto("/contacts");
    await page.click(".crm-sidebar-toggle");
    await page.waitForSelector('.crm-shell[data-sidebar-open="true"]');
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.body).overflow),
      "hidden",
      "Mobile drawer must lock background scrolling",
    );
    await page.keyboard.press("Escape");
    await page.waitForSelector('.crm-shell[data-sidebar-open="false"]');
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector(".crm-sidebar-backdrop"))
          .visibility === "hidden",
    );
    await page.click(".crm-profile-button");
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".crm-profile-menu [role=menuitem]")].some(
        (node) =>
          node.textContent === "Install the application" &&
          getComputedStyle(node).visibility === "visible",
      ),
    );
    await page.waitForFunction(
      () =>
        Number(
          getComputedStyle(document.querySelector(".crm-profile-menu")).opacity,
        ) > 0.99,
    );
    const installItem = await page.evaluateHandle(() =>
      [...document.querySelectorAll(".crm-profile-menu [role=menuitem]")].find(
        (node) => node.textContent === "Install the application",
      ),
    );
    await installItem.asElement().click();
    await page.waitForSelector(".crm-pwa-install", { visible: true });
    let dialog = await page.$eval(".crm-pwa-install", (node) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });
    assert(
      dialog.left >= 0 &&
        dialog.right <= 390 &&
        dialog.top >= 0 &&
        dialog.bottom <= 844,
      "Install dialog clipped",
    );
    await page.keyboard.press("Escape");
    await page.waitForSelector(".crm-pwa-install", { hidden: true });
    const clickButton = async (text) =>
      page.evaluate((text) => {
        const node = [...document.querySelectorAll("button")].find(
          (node) =>
            node.getClientRects().length && node.textContent.trim() === text,
        );
        if (!node) throw Error("Missing button: " + text);
        node.click();
      }, text);
    await clickButton("Add New");
    await page.waitForSelector("#field-fullName", { visible: true });
    for (const height of [844, 430]) {
      await page.setViewport({ width: 390, height });
      await page.waitForFunction(() => {
        const node = document
          .querySelector("#field-fullName")
          ?.closest(".chakra-modal__content");
        if (!node) return false;
        const r = node.getBoundingClientRect();
        return (
          r.left >= 0 &&
          r.right <= innerWidth &&
          r.top >= 0 &&
          r.bottom <= innerHeight + 1
        );
      });
      const bounds = await page.$eval("#field-fullName", (input) => {
        const node = input.closest(".chakra-modal__content");
        const r = node.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          body: getComputedStyle(node.querySelector(".chakra-modal__body"))
            .overflowY,
        };
      });
      assert(
        bounds.left >= 0 &&
          bounds.right <= 390 &&
          bounds.top >= 0 &&
          bounds.bottom <= height + 1,
        "Form clipped when keyboard reduces height: " + JSON.stringify(bounds),
      );
      assert.equal(
        await page.$eval("#field-fullName", (node) =>
          parseFloat(getComputedStyle(node).fontSize),
        ),
        16,
        "Avoid iOS form auto zoom",
      );
    }
    await page.keyboard.press("Escape");
    await page.setViewport({ width: 390, height: 844 });
    console.log(
      "PASS: touch navigation, install dialog and keyboard-height form layout",
    );
    await goto("/audit-logs");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForFunction(() =>
      Boolean(navigator.serviceWorker.controller),
    );
    const cdp = await page.createCDPSession();
    await cdp.send("Page.enable");
    const manifest = await cdp.send("Page.getAppManifest");
    assert.equal(manifest.errors.length, 0, "Manifest errors");
    const parsed = JSON.parse(manifest.data);
    assert.equal(parsed.display, "standalone");
    assert(parsed.icons.some((icon) => icon.sizes === "192x192"));
    assert(
      parsed.icons.some(
        (icon) => icon.sizes === "512x512" && icon.purpose === "maskable",
      ),
    );
    const cacheUrls = await page.evaluate(async () => {
      const urls = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        urls.push(
          ...(await cache.keys()).map(
            (request) => new URL(request.url).pathname,
          ),
        );
      }
      return urls;
    });
    assert.deepEqual(
      cacheUrls.sort(),
      ["/offline.html", "/pwa/icon-192.png"],
      "Only public offline assets may be cached",
    );
    const rootCache = await page.evaluate(async () => {
      const cache = await caches.open("crm-unrelated-fixture");
      await cache.put("/unrelated", new Response("keep"));
      return true;
    });
    assert(rootCache);
    workerVersion = 1;
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration.update();
    });
    await page.waitForSelector(".crm-pwa-status", { visible: true });
    await page.$eval("#audit-search", (input) => {
      input.value = "Unsaved filter";
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(
      await page.$eval("#audit-search", (input) => input.value),
      "Unsaved filter",
      "Updates must not reload automatically",
    );
    const navigation = page.waitForNavigation({ waitUntil: "networkidle0" });
    await clickButton("Reload and update");
    await navigation;
    assert(
      await page.evaluate(async () =>
        Boolean(await caches.match("/unrelated")),
      ),
      "Unrelated caches must remain",
    );
    await page.evaluate(() => localStorage.setItem("crm-language", "fa"));
    offlineServer = true;
    await page.setOfflineMode(true);
    await page.goto(origin + "/properties", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#retry");
    assert(
      await page.$eval(
        "main img",
        (image) => image.complete && image.naturalWidth > 0,
      ),
      "Offline logo must load from the public cache",
    );
    assert.equal(await page.$eval("html", (node) => node.lang), "fa");
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({ path: path.join(artifacts, "offline-fa.png") });
    offlineServer = false;
    await page.setOfflineMode(false);
    const recovered = await page
      .waitForSelector(".crm-content", { timeout: 3000 })
      .catch(() => null);
    if (!recovered) {
      await page.waitForSelector("#retry", { visible: true });
      await page.click("#retry");
    }
    await page.waitForSelector(".crm-content");
    console.log(
      "PASS: real service worker, manifest, public-only cache, explicit update and Persian offline recovery",
    );
    assert.deepEqual(errors, [], "Runtime errors");
  } catch (error) {
    console.error("Browser route: " + (page ? page.url() : "not started"));
    if (page) await page.screenshot({ path: path.join(artifacts, 'mobile-records-failure.png'), fullPage: true }).catch(() => {});
    if (page)
      console.error(
        "Page state: " +
          JSON.stringify(
            await page.evaluate(() => ({
              online: navigator.onLine,
              title: document.title,
              text: document.body.innerText.slice(-1200),
            })),
          ),
      );
    console.error("Recent requests: " + JSON.stringify(requests.slice(-25)));
    throw error;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
