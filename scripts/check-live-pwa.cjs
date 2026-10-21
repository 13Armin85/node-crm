// Read-only verification against the public HTTPS endpoint; no CRM login or writes.
const assert = require("node:assert/strict");
const puppeteer = require("../server/node_modules/puppeteer");
(async () => {
  const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    pipe: true,
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto("https://37.148.206.74/auth/sign-in", {
      waitUntil: "networkidle2",
    });
    await page.waitForSelector('input[name="username"]');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() =>
      Boolean(navigator.serviceWorker.controller),
    );
    const client = await page.createCDPSession();
    const manifest = await client.send("Page.getAppManifest");
    assert.equal(manifest.errors.length, 0);
    const install = await client.send("Page.getInstallabilityErrors");
    const state = await page.evaluate(async () => ({
      secure: window.isSecureContext,
      worker: Boolean(navigator.serviceWorker.controller),
      width: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      cacheUrls: (
        await Promise.all(
          (await caches.keys()).map(async (name) =>
            (await (await caches.open(name)).keys()).map(
              (request) => new URL(request.url).pathname,
            ),
          ),
        )
      ).flat(),
    }));
    assert.equal(state.secure, true);
    assert.equal(state.worker, true);
    assert(state.pageWidth <= state.width);
    assert.deepEqual(state.cacheUrls.sort(), [
      "/offline.html",
      "/pwa/icon-192.png",
    ]);
    assert.deepEqual(
      install.installabilityErrors,
      [],
      "Public site installability",
    );
    console.log(
      JSON.stringify({
        https: true,
        serviceWorker: true,
        manifestValid: true,
        installabilityErrors: install.installabilityErrors,
        privateDataCached: false,
        mobileOverflow: false,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
