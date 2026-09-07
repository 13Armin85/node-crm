const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.name === 'node_modules' || entry.name === 'uploads' ? [] : entry.isDirectory() ? files(path.join(dir, entry.name)) : entry.name.endsWith('.js') ? [path.join(dir, entry.name)] : []);
const sourceFiles = files(path.resolve(__dirname, '..'));
for (const file of sourceFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) { process.stderr.write(result.stderr); process.exitCode = 1; }
}
if (!process.exitCode) { require('../controllers/route'); console.log(`Syntax and route imports passed (${sourceFiles.length} files).`); }
