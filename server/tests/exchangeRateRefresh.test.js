const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const https = require('node:https');
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
  assert.equal(calls, 3); // One hourly and one daily fallback, shared by all callers.
  assert(stale.every(rate => rate.stale && rate.tryPerUsd === 34));
  await getTryUsdRate(); assert.equal(calls, 3);
  now += 30001; failing = false;
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
