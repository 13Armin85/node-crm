const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const cacheFile = () => process.env.EXCHANGE_RATE_CACHE_FILE
  || ((process.env.NODE_TEST_CONTEXT || process.env.NODE_ENV === 'test') ? null : path.resolve(__dirname, '../.cache/exchange-rate.json'));
const valid = value => value && ['tryPerUsd', 'tryPerEur'].every(key => Number.isFinite(value[key]) && value[key] > 0)
  && /^TCMB (hourly|daily)$/.test(value.source) && Number.isFinite(Date.parse(value.fetchedAt));

async function readCachedRate(filename = cacheFile()) {
  if (!filename) return null;
  try {
    const value = JSON.parse(await fs.readFile(filename, 'utf8'));
    return valid(value) ? { value, cachedAt: Date.parse(value.fetchedAt) } : null;
  } catch { return null; }
}
async function writeCachedRate(value, filename = cacheFile()) {
  if (!filename || !valid(value)) return false;
  const temporary = filename + '.' + crypto.randomUUID() + '.tmp';
  try {
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(temporary, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporary, filename);
    return true;
  } finally { await fs.unlink(temporary).catch(() => {}); }
}
module.exports = { readCachedRate, writeCachedRate };
