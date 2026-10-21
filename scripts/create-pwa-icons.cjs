// Package the existing brand mark at standard launcher sizes; no external assets.
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("../server/node_modules/puppeteer");
(async () => {
  const root = path.resolve(__dirname, "../client/public");
  const directory = path.join(root, "pwa");
  fs.mkdirSync(directory, { recursive: true });
  const logo =
    "data:image/png;base64," +
    fs.readFileSync(path.join(root, "brand-logo-ta.png")).toString("base64");
  const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    pipe: true,
  });
  try {
    const page = await browser.newPage();
    for (const [name, size, padding] of [
      ["icon-192", 192, 0.06],
      ["icon-512", 512, 0.06],
      ["icon-maskable-512", 512, 0.18],
      ["apple-touch-icon", 180, 0.08],
    ]) {
      const png = await page.evaluate(
        async (logo, size, padding) => {
          const image = new Image();
          image.src = logo;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          const context = canvas.getContext("2d");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, size, size);
          context.drawImage(
            image,
            size * padding,
            size * padding,
            size * (1 - 2 * padding),
            size * (1 - 2 * padding),
          );
          return canvas.toDataURL("image/png").split(",")[1];
        },
        logo,
        size,
        padding,
      );
      fs.writeFileSync(
        path.join(directory, name + ".png"),
        Buffer.from(png, "base64"),
      );
    }
    console.log("PWA launcher icons created.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
