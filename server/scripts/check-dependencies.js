const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
let checked = 0;
for (const [location, entry] of Object.entries(lock.packages)) {
  if (!location || entry.dev || entry.optional || entry.link) continue;
  const filename = path.join(root, location, 'package.json');
  const installed = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')).version : 'missing';
  if (installed !== entry.version) {
    console.error(`${location}: installed ${installed}, expected ${entry.version}`);
    process.exitCode = 1;
  }
  checked++;
}
if (!process.exitCode) console.log(`Verified ${checked} installed backend dependencies against lockfile`);
