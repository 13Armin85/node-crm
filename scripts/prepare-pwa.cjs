// Stamp each production service worker so updates follow the deployed client build.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const publicRoot = path.resolve(__dirname, "../client/public");
const buildRoot = path.resolve(
  __dirname,
  "../client",
  process.env.BUILD_PATH || "build",
);
const source = fs.readFileSync(
  path.join(publicRoot, "service-worker.js"),
  "utf8",
);
const hash = crypto.createHash("sha256");
for (const file of ["service-worker.js", "offline.html", "manifest.json"])
  hash.update(fs.readFileSync(path.join(publicRoot, file)));
hash.update(fs.readFileSync(path.join(buildRoot, "asset-manifest.json")));
const version = hash.digest("hex").slice(0, 16);
if (!source.includes("__CRM_BUILD_VERSION__"))
  throw new Error("Service worker version marker missing");
fs.writeFileSync(
  path.join(buildRoot, "service-worker.js"),
  source.replace("__CRM_BUILD_VERSION__", version),
  "utf8",
);
console.log("PWA service worker prepared: " + version);
