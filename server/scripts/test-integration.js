const { spawnSync } = require('node:child_process');
const path = require('node:path');
const flags = ['SECURITY', 'COMMISSION', 'ESTATE', 'AUDIT', 'PASSWORD_CHANGE', 'CRM_FIXES', 'DOCUMENTS', 'FORM_BUILDER', 'LEAD_CONVERSION', 'NOTIFICATION', 'PIPELINE', 'RECORD_IMPORT', 'BACKEND', 'SHARING', 'VISIBILITY'];
const env = { ...process.env, ...Object.fromEntries(flags.map(flag => [flag + '_INTEGRATION', '1'])) };
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=2', 'tests/*.test.js'], {
  cwd: path.resolve(__dirname, '..'), env, stdio: 'inherit', windowsHide: true,
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
