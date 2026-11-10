const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const https = require('node:https');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const modulePath = require.resolve('../services/exchangeRate');
const xml = '<tcmbVeri><kur><doviz_cinsi>USD</doviz_cinsi><birim>1</birim><alis>34</alis></kur><kur><doviz_cinsi>EUR</doviz_cinsi><birim>1</birim><alis>37</alis></kur></tcmbVeri>';

test('concurrent dashboards share one exchange refresh, preserve cache and bound failure retries', async t => {
  let calls = 0, failing = false;
  let now = 1800000000000;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(https, 'get', (url, options, callback) => {
    calls++;
    const request = new EventEmitter();
    request.destroy = error => { queueMicrotask(() => request.emit('error', error)); };
    queueMicrotask(() => {
      if (failing) return request.emit('error', new Error('upstream down'));
      const response = new EventEmitter(); response.statusCode = 200; response.setEncoding = () => {};
      callback(response); response.emit('data', xml); response.emit('end');
    });
    return request;
  });
  delete require.cache[modulePath];
  const { getTryUsdRate } = require(modulePath);
  const results = await Promise.all(Array.from({ length: 30 }, () => getTryUsdRate()));
  assert.equal(calls, 1);
  assert(results.every(rate => rate.tryPerUsd === 34 && rate.tryPerEur === 37 && !rate.stale));
  await getTryUsdRate(); assert.equal(calls, 1);
  now += 3600000; failing = true;
  const stale = await Promise.all(Array.from({ length: 30 }, () => getTryUsdRate()));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 3); // One hourly and one daily fallback, shared by all callers.
  assert(stale.every(rate => rate.stale && rate.tryPerUsd === 34));
  await getTryUsdRate(); assert.equal(calls, 3);
  now += 30001; failing = false;
  assert.equal((await getTryUsdRate()).stale, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await getTryUsdRate()).stale, false);
  assert.equal(calls, 4);
  delete require.cache[modulePath];
});

test('oversized upstream XML is rejected and an unavailable rate does not produce repeated calls', async t => {
  let calls = 0;
  t.mock.method(https, 'get', (url, options, callback) => {
    calls++;
    const request = new EventEmitter();
    request.destroy = error => queueMicrotask(() => request.emit('error', error));
    queueMicrotask(() => {
      const response = new EventEmitter(); response.statusCode = 200; response.setEncoding = () => {};
      callback(response); response.emit('data', 'a'.repeat(524289)); response.emit('end');
    });
    return request;
  });
  delete require.cache[modulePath];
  const { getTryUsdRate } = require(modulePath);
  await assert.rejects(getTryUsdRate(), /too large/);
  await assert.rejects(getTryUsdRate(), /too large/);
  assert.equal(calls, 2);
  delete require.cache[modulePath];
});

test('a verified rate survives a process restart and remains available during an upstream outage', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-rate-cache-'));
  const filename = path.join(directory, 'exchange-rate.json');
  const previousPath = process.env.EXCHANGE_RATE_CACHE_FILE;
  process.env.EXCHANGE_RATE_CACHE_FILE = filename;
  t.after(async () => {
    if (previousPath === undefined) delete process.env.EXCHANGE_RATE_CACHE_FILE; else process.env.EXCHANGE_RATE_CACHE_FILE = previousPath;
    delete require.cache[modulePath];
    await fs.unlink(filename).catch(() => {}); await fs.rmdir(directory);
  });
  let failing = false, calls = 0;
  t.mock.method(https, 'get', (url, options, callback) => {
    calls++;
    const request = new EventEmitter();
    request.destroy = error => queueMicrotask(() => request.emit('error', error));
    queueMicrotask(() => {
      if (failing) return request.emit('error', new Error('upstream down'));
      const response = new EventEmitter(); response.statusCode = 200; response.setEncoding = () => {};
      callback(response); response.emit('data', xml); response.emit('end');
    });
    return request;
  });
  delete require.cache[modulePath];
  await require(modulePath).getTryUsdRate();
  const stored = JSON.parse(await fs.readFile(filename, 'utf8'));
  assert.equal(stored.tryPerUsd, 34); assert.equal(stored.tryPerEur, 37);
  failing = true; delete require.cache[modulePath];
  const restored = await require(modulePath).getTryUsdRate();
  assert.equal(restored.tryPerUsd, 34); assert.equal(calls, 1);
  // Expired persisted data is returned immediately while one refresh runs.
  stored.fetchedAt = new Date(Date.now() - 3600000).toISOString();
  await fs.writeFile(filename, JSON.stringify(stored)); delete require.cache[modulePath];
  const stale = await require(modulePath).getTryUsdRate();
  assert.equal(stale.tryPerUsd, 34); assert.equal(stale.stale, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 3);
  assert.equal((await require(modulePath).getTryUsdRate()).tryPerUsd, 34);
  assert.equal(calls, 3);
  assert.equal(JSON.parse(await fs.readFile(filename, 'utf8')).tryPerUsd, 34);
});

test('corrupt or invalid saved rates are ignored', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-rate-invalid-'));
  const filename = path.join(directory, 'exchange-rate.json');
  t.after(async () => { await fs.unlink(filename).catch(() => {}); await fs.rmdir(directory); });
  const { readCachedRate, writeCachedRate } = require('../services/exchangeRateCache');
  await fs.writeFile(filename, '{broken'); assert.equal(await readCachedRate(filename), null);
  await fs.writeFile(filename, JSON.stringify({ tryPerUsd: -1, tryPerEur: 37, source: 'TCMB daily', fetchedAt: new Date().toISOString() }));
  assert.equal(await readCachedRate(filename), null);
  assert.equal(await writeCachedRate({ tryPerUsd: 0 }, filename), false);
});
