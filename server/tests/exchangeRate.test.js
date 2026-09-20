const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTcmbUsd, parseTcmbHourlyUsd, hourlyCandidates } = require('../services/exchangeRate');

test('parses the official TCMB USD buying and selling rates', () => {
  const rate = parseTcmbUsd('<Tarih_Date Date="19.09.2026"><Currency CurrencyCode="USD"><ForexBuying>41.0000</ForexBuying><ForexSelling>42.0000</ForexSelling></Currency></Tarih_Date>');
  assert.equal(rate.buying, 41);
  assert.equal(rate.selling, 42);
  assert.equal(rate.tryPerUsd, 41.5);
  assert.equal(rate.usdPerTry, 1 / 41.5);
  assert.equal(rate.sourceDate, '19.09.2026');
});

test('rejects a malformed TCMB response', () => {
  assert.throws(() => parseTcmbUsd('<Tarih_Date />'), /USD rate/);
});

test('parses the official hourly TCMB USD rate', () => {
  const rate = parseTcmbHourlyUsd('<tcmbVeri><baslik_bilgi><zaman_etiketi>2026-09-18T15:02:00+03:00</zaman_etiketi></baslik_bilgi><doviz_kur_liste gecerlilik_tarihi="2026-9-18" saat="15:00"><kur><doviz_cinsi_tabani>TRY</doviz_cinsi_tabani><doviz_cinsi>USD</doviz_cinsi><birim>1</birim><alis>48,704</alis></kur></doviz_kur_liste></tcmbVeri>');
  assert.equal(rate.tryPerUsd, 48.704);
  assert.equal(rate.sourceHour, '15:00');
  assert.equal(rate.publishedAt, '2026-09-18T15:02:00+03:00');
});

test('hourly candidates prefer the latest Istanbul publication and fall back by date', () => {
  const candidates = hourlyCandidates(new Date('2026-09-18T11:30:00Z'));
  assert.match(candidates[0], /18092026-1400\.xml$/);
  assert.match(candidates[5], /17092026-1500\.xml$/);
});
