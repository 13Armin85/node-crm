// Isolated browser fixtures; never sends requests to the live API.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const puppeteer = require("../server/node_modules/puppeteer");
const ExcelJS = require("../client/node_modules/exceljs");
async function main() {
  const build = path.resolve(__dirname, "../client/build");
  assert(
    fs.existsSync(path.join(build, "index.html")),
    "Build the client first",
  );
  const server = http.createServer((req, res) => {
    let file = path.resolve(
      build,
      decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(
        /^\/+/,
        "",
      ) || "index.html",
    );
    if (!file.startsWith(build + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile())
      file = path.join(build, "index.html");
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".json": "application/json",
      }[path.extname(file)] || "application/octet-stream",
    );
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser, page;
  try {
    browser = await puppeteer.launch({
      executablePath:
        process.env.CHROME_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      headless: true,
      pipe: true,
    });
    page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const origin = "http://127.0.0.1:" + server.address().port;
    const admin = {
      _id: "000000000000000000000001",
      role: "admin",
      firstName: "Admin",
      lastName: "Person",
      username: "admin@example.test",
    };
    const other = {
      _id: "000000000000000000000002",
      role: "user",
      firstName: "Other",
      lastName: "User",
      username: "other@example.test",
    };
    const idle = {
      _id: "000000000000000000000003",
      role: "user",
      firstName: "No History",
      username: "empty@example.test",
    };
    const users = [admin, other, idle];
    let currentUser = admin;
    const event = {
      _id: "100000000000000000000001",
      actorId: admin._id,
      actorName: "Admin Person",
      actorUsername: admin.username,
      collection: "Properties",
      operation: "update",
      recordCount: 1,
      action: "update",
      recordId: admin._id,
      recordLabel: "Seaside apartment",
      createdAt: "2026-10-20T12:00:00Z",
      changes: [
        { field: "Seaside", before: "Before name", after: "After name" },
        { field: "password", before: "[REDACTED]", after: "[REDACTED]" },
      ],
    };
    const requests = [];
    let updates = 0,
      auditFailure = 0;
    const artifacts = path.resolve(__dirname, "../layout-artifacts/audit-logs");
    fs.mkdirSync(artifacts, { recursive: true });
    const downloads = path.join(artifacts, "downloads-" + Date.now());
    fs.mkdirSync(downloads, { recursive: true });
    const cdp = await browser.target().createCDPSession();
    await cdp.send("Browser.setDownloadBehavior", {
      behavior: "allowAndName",
      downloadPath: downloads,
    });
    const download = async () => {
      const before = new Set(fs.readdirSync(downloads));
      await page.waitForFunction(() => {
        const button = document.querySelector(
          ".crm-audit-logs .crm-excel-export",
        );
        return button && !button.disabled;
      });
      await page.click(".crm-audit-logs .crm-excel-export");
      let file;
      for (let n = 0; n < 200; n++) {
        file = fs
          .readdirSync(downloads)
          .find((name) => !before.has(name) && !name.endsWith(".crdownload"));
        if (file) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert(file, "Audit Excel download missing");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fs.readFileSync(path.join(downloads, file)));
      const sheet = workbook.getWorksheet(1);
      assert.equal(sheet.columnCount, 6);
      assert.equal(sheet.views[0].ySplit, 1);
      assert(sheet.autoFilter);
      const text = sheet.getSheetValues().flat(2).join(" ");
      for (const raw of [
        "Before name",
        "After name",
        "[REDACTED]",
        admin._id,
        "customFields",
      ])
        assert(!text.includes(raw), "Technical audit data leaked into Excel");
      return { sheet, text };
    };
    await page.setRequestInterception(true);
    page.on("request", async (req) => {
      const url = new URL(req.url()),
        route = url.pathname;
      if (!route.startsWith("/api/")) {
        await req.continue().catch(() => {});
        return;
      }
      requests.push({ route, query: url.search, headers: req.headers() });
      let data = [],
        status = 200;
      if (route === "/api/user" || route === "/api/user/")
        data = { user: users };
      if (route.startsWith("/api/user/view/"))
        data = users.find((user) => user._id === route.split("/").pop());
      if (route.startsWith("/api/user/edit/")) {
        updates++;
        const user = users.find((user) => user._id === route.split("/").pop());
        Object.assign(user, JSON.parse(req.postData()));
        data = { acknowledged: true, modifiedCount: 1, user };
      }
      if (route.startsWith("/api/estate/definitions/"))
        data = { moduleName: "Users", fields: [] };
      if (route.startsWith("/api/visibility"))
        data = { visibility: {}, accessibleModules: [] };
      if (route.startsWith("/api/notification"))
        data = { notifications: [], unreadCount: 0, hasMore: false };
      if (route === "/api/audit-logs") {
        const selected =
          currentUser.role === "user"
            ? currentUser._id
            : url.searchParams.get("actorId");
        const person = selected === other._id ? other : admin;
        const empty = selected === idle._id;
        const personal = Boolean(selected);
        data = {
          items: empty
            ? []
            : [
                {
                  ...event,
                  actorId: person._id,
                  actorName: person.firstName + " " + (person.lastName || ""),
                  actorUsername: person.username,
                },
              ],
          total: empty ? 0 : personal ? 1 : 26,
          summary: {
            create: empty || personal ? 0 : 5,
            update: empty ? 0 : personal ? 1 : 18,
            delete: empty || personal ? 0 : 1,
          },
          actors:
            currentUser.role === "user"
              ? []
              : users.map((user) => ({
                  _id: user._id,
                  name: [user.firstName, user.lastName]
                    .filter(Boolean)
                    .join(" "),
                  username: user.username,
                })),
          collections: empty ? [] : ["Properties"],
        };
      }
      if (
        route === "/api/audit-logs" &&
        url.searchParams.get("limit") === "100"
      ) {
        const rows = data.items.length
          ? Array.from({ length: data.total }, (_, index) => ({
              ...data.items[0],
              _id: "export-" + index,
            }))
          : [];
        const start = (Number(url.searchParams.get("page") || 1) - 1) * 100;
        data.items = rows.slice(start, start + 100);
      }
      if (route === "/api/audit-logs" && auditFailure > 0) {
        auditFailure--;
        status = 404;
        data = { code: "notFound" };
      }
      await req
        .respond({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        })
        .catch(() => {});
    });
    const button = async (text) =>
      page.evaluate((text) => {
        const nodes = [...document.querySelectorAll("button")].filter(
          (node) =>
            node.getClientRects().length &&
            (node.textContent.trim().startsWith(text) || (node.getAttribute("aria-label") || "").toLowerCase() === text.toLowerCase()),
        );
        if (!nodes.length) throw new Error("Button missing: " + text);
        nodes[nodes.length - 1].click();
      }, text);
    const input = (selector, value) =>
      page.$eval(
        selector,
        (node, value) => {
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          ).set.call(node, value);
          node.dispatchEvent(new Event("input", { bubbles: true }));
        },
        value,
      );
    const token =
      Buffer.from("{}").toString("base64url") +
      "." +
      Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString("base64url") +
      ".fixture";
    const session = async (user, remember = true, language = "en") => {
      currentUser = user;
      await page.goto(origin + "/auth", { waitUntil: "networkidle0" });
      await page.evaluate(
        (user, token, remember, language) => {
          localStorage.clear();
          sessionStorage.clear();
          localStorage.setItem("user", JSON.stringify(user));
          (remember ? localStorage : sessionStorage).setItem("token", token);
          localStorage.setItem("crm-language", language);
        },
        user,
        token,
        remember,
        language,
      );
    };
    await page.setViewport({ width: 1440, height: 1000 });
    await session(admin);
    await page.goto(origin + "/admin-setting", { waitUntil: "networkidle0" });
    assert(
      await page.$eval(".crm-settings-grid", (node) =>
        node.textContent.includes("Logs"),
      ),
    );
    await page.evaluate(() =>
      [...document.querySelectorAll(".crm-stat-card")]
        .find((node) => node.textContent.trim() === "Logs")
        .click(),
    );
    await page.waitForSelector("#audit-actor");
    await page.waitForSelector(".crm-audit-table tbody tr");
    const activityText = await page.$eval(
      ".crm-audit-results",
      (node) => node.textContent,
    );
    assert(activityText.includes("Admin Person edited and saved property"));
    assert(activityText.includes("Seaside apartment"));
    for (const raw of ["Before name", "After name", "[REDACTED]", admin._id])
      assert(!activityText.includes(raw));
    const allExport = await download();
    assert.equal(
      allExport.sheet.rowCount,
      27,
      "Export must include all rows beyond the visible table",
    );
    assert(allExport.text.includes("Admin Person edited and saved property"));
    const personResponse = page.waitForResponse((response) =>
      response.url().includes("actorId=" + other._id),
    );
    await page.select("#audit-actor", other._id);
    await personResponse;
    await page.waitForSelector(".crm-audit-table tbody tr");
    await page.waitForFunction(() =>
      document
        .querySelector(".crm-audit-user-scope-title")
        ?.textContent.includes("Other User"),
    );
    assert(
      (
        await page.$eval(".crm-audit-results", (node) => node.textContent)
      ).includes("Other User"),
    );
    const userExport = await download();
    assert.equal(userExport.sheet.rowCount, 2);
    assert(userExport.text.includes("Other User"));
    assert(!userExport.text.includes("Admin Person"));
    await page.goto(origin + "/audit-logs?actorId=" + idle._id, {
      waitUntil: "networkidle0",
    });
    assert.equal(
      await page.$eval("#audit-actor", (node) => node.value),
      idle._id,
    );
    assert.equal(await page.$(".crm-audit-table tbody tr"), null);
    assert(
      await page.$eval(
        ".crm-audit-logs .crm-excel-export",
        (node) => node.disabled,
      ),
    );
    assert(
      (await page.$eval("#audit-actor", (node) => node.textContent)).includes(
        "No History",
      ),
    );
    await page.select("#audit-actor", "");
    await page.waitForSelector(".crm-audit-table tbody tr");
    await input("#audit-search", "Seaside");
    const filteredResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/audit-logs?") &&
        response.url().includes("q=Seaside"),
    );
    await button("Apply filters");
    await filteredResponse;
    await page.waitForSelector(".crm-audit-table tbody tr");
    assert(
      requests.some(
        (request) =>
          request.route === "/api/audit-logs" &&
          request.query.includes("q=Seaside"),
      ),
    );
    await button("Next page");
    await page.waitForFunction(() =>
      document
        .querySelector(".crm-audit-logs")
        ?.textContent.includes("Page: 2"),
    );
    const filteredExport = await download();
    assert.equal(filteredExport.sheet.rowCount, 27);
    assert(
      requests.some(
        (request) =>
          request.route === "/api/audit-logs" &&
          request.query.includes("q=Seaside") &&
          request.query.includes("limit=100") &&
          request.query.includes("page=1"),
      ),
    );
    console.log(
      "PASS: valid full XLSX downloads, selected-user and applied-search exports, readable columns and no technical data.",
    );
    console.log(
      "PASS: readable activity summaries, immediate per-user filtering, empty user history and pagination.",
    );
    for (const remember of [true, false]) {
      await session(admin, remember);
      await page.goto(origin + "/userView/" + admin._id, {
        waitUntil: "networkidle0",
      });
      await button("Edit");
      await page.waitForSelector("input[name=firstName]");
      assert.equal(
        await page.$eval("input[name=username]", (node) => node.disabled),
        false,
      );
      await input(
        "input[name=firstName]",
        remember ? "Remembered edit" : "Session edit",
      );
      await input(
        "input[name=username]",
        remember ? "remembered@example.test" : "session@example.test",
      );
      await button("Save");
      await page.waitForFunction(
        () => !document.querySelector("input[name=firstName]"),
      );
      const state = await page.evaluate(() => ({
        url: location.pathname,
        user: JSON.parse(localStorage.getItem("user")),
        local: localStorage.getItem("token"),
        session: sessionStorage.getItem("token"),
        header: document.querySelector(".crm-profile-trigger")?.textContent,
      }));
      assert(state.url.startsWith("/userView/"));
      assert.equal(state.user.role, "admin");
      assert.equal(
        state.user.firstName,
        remember ? "Remembered edit" : "Session edit",
      );
      assert.equal(
        state.user.username,
        remember ? "remembered@example.test" : "session@example.test",
      );
      assert.equal(remember ? state.local : state.session, token);
      assert.equal(remember ? state.session : state.local, null);
    }
    assert.equal(updates, 2);
    console.log(
      "PASS: own name and username edits keep the authenticated screen and original token for both storage modes.",
    );
    auditFailure = 1;
    await page.goto(origin + "/audit-logs", { waitUntil: "networkidle0" });
    await page.waitForSelector(".crm-audit-error");
    await button("Retry");
    await page.waitForSelector(".crm-audit-table tbody tr");
    assert.equal(await page.$(".crm-audit-error"), null);
    assert.equal(
      await page.$$eval(".crm-audit-stat", (nodes) => nodes.length),
      4,
    );
    console.log(
      "PASS: unavailable backend shows a useful error and retry recovers the page.",
    );
    await session(admin, true, "fa");
    for (const mode of ["light", "dark"]) {
      await page.evaluate(
        (mode) => localStorage.setItem("chakra-ui-color-mode", mode),
        mode,
      );
      await page.goto(origin + "/audit-logs", { waitUntil: "networkidle0" });
      await page.waitForSelector(".crm-audit-table tbody tr");
      if (mode === "light") {
        const persian = await download();
        assert.equal(persian.sheet.views[0].rightToLeft, true);
        assert.equal(persian.sheet.getCell("A1").value, "تاریخ و ساعت");
      }
      await page.screenshot({
        path: path.join(artifacts, "fa-" + mode + "-desktop.png"),
        fullPage: true,
      });
    }
    await session(other, false, "fa");
    await page.evaluate(() =>
      localStorage.setItem("chakra-ui-color-mode", "dark"),
    );
    await page.goto(origin + "/audit-logs", { waitUntil: "networkidle0" });
    await page.waitForSelector(".crm-audit-logs");
    assert.equal(await page.$("#audit-actor"), null);
    assert.equal(
      await page.$eval(".crm-audit-logs", (node) => node.dir),
      "rtl",
    );
    assert(
      (
        await page.$eval(".crm-audit-logs", (node) => node.textContent)
      ).includes("\u0644\u0627\u06af\u200c\u0647\u0627"),
    );
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      if (width === 390) {
        await page.keyboard.press("Escape");
        await page.waitForSelector('.crm-shell[data-sidebar-open="false"]');
        await page.waitForFunction(
          () =>
            getComputedStyle(document.querySelector(".crm-sidebar-backdrop"))
              .visibility === "hidden",
        );
        await page.waitForSelector(".crm-audit-mobile-event", {
          visible: true,
        });
        await page.screenshot({
          path: path.join(artifacts, "fa-dark-mobile.png"),
          fullPage: true,
        });
      }
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "Logs page overflows the viewport",
      );
    }
    const ownExport = await download();
    assert.equal(ownExport.sheet.rowCount, 2);
    assert.equal(ownExport.sheet.views[0].rightToLeft, true);
    assert(ownExport.text.includes("Other User"));
    const ownRequest = requests
      .filter(
        (request) =>
          request.route === "/api/audit-logs" &&
          request.query.includes("limit=100"),
      )
      .at(-1);
    assert(!ownRequest.query.includes("actorId"));
    assert(!ownRequest.headers["x-crm-data-user"]);
    console.log(
      "PASS: Persian RTL Excel and personal export download on mobile.",
    );
    assert.deepEqual(errors, [], "Browser runtime errors");
    console.log(
      "PASS: ordinary users reach their Logs page in Persian on desktop/mobile without the actor filter.",
    );
  } catch (error) {
    if (page)
      console.error(
        await page.evaluate(() => ({
          path: location.pathname,
          text: document.body.innerText.slice(-2500),
        })),
      );
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
