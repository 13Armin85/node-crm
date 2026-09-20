const https = require('https');

const SOURCE_URL = process.env.TCMB_EXCHANGE_RATE_URL || 'https://www.tcmb.gov.tr/kurlar/today.xml';
const HOURLY_BASE_URL = process.env.TCMB_HOURLY_RATE_URL || 'https://www.tcmb.gov.tr/reeskontkur';
const CACHE_MS = Math.max(60_000, Number(process.env.EXCHANGE_RATE_CACHE_MS) || 5 * 60_000);
let cached = null;

const tagValue = (xml, tag) => {
  const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, 'i'));
  return match ? Number(match[1].replace(',', '.')) : NaN;
};

const parseTcmbCurrency = (xml, code) => {
  const currency = xml.match(new RegExp(`<Currency\\b[^>]*(?:CurrencyCode|Kod)="${code}"[^>]*>([\\s\\S]*?)<\\/Currency>`, 'i'));
  if (!currency) throw new Error(`${code} rate is missing from the TCMB response`);
  const buying = tagValue(currency[1], 'ForexBuying');
  const selling = tagValue(currency[1], 'ForexSelling');
  if (!Number.isFinite(buying) || !Number.isFinite(selling) || buying <= 0 || selling <= 0) {
    throw new Error(`TCMB returned an invalid ${code} rate`);
  }
  const date = xml.match(/<Tarih_Date\b[^>]*(?:Date|Tarih)="([^"]+)"/i)?.[1] || null;
  const tryPerUsd = (buying + selling) / 2;
  return { code, buying, selling, tryPerUnit: tryPerUsd, sourceDate: date };
};
const parseTcmbUsd = xml => {
  const rate = parseTcmbCurrency(xml, 'USD');
  return { base: 'TRY', quote: 'USD', buying: rate.buying, selling: rate.selling, tryPerUsd: rate.tryPerUnit, usdPerTry: 1 / rate.tryPerUnit, sourceDate: rate.sourceDate };
};

const parseTcmbHourlyCurrency = (xml, code) => {
  const currency = [...xml.matchAll(/<kur>([\s\S]*?)<\/kur>/gi)]
    .map(match => match[1])
    .find(item => new RegExp(`<doviz_cinsi>\\s*${code}\\s*<\\/doviz_cinsi>`, 'i').test(item));
  if (!currency) throw new Error(`${code} rate is missing from the hourly TCMB response`);
  const buying = tagValue(currency, 'alis');
  const unit = tagValue(currency, 'birim') || 1;
  const tryPerUsd = buying / unit;
  if (!Number.isFinite(tryPerUsd) || tryPerUsd <= 0) throw new Error(`TCMB returned an invalid hourly ${code} rate`);
  const sourceDate = xml.match(/gecerlilik_tarihi="([^"]+)"/i)?.[1] || null;
  const sourceHour = xml.match(/\bsaat="([^"]+)"/i)?.[1] || null;
  const publishedAt = xml.match(/<zaman_etiketi>([^<]+)<\/zaman_etiketi>/i)?.[1] || null;
  return { code, buying: tryPerUsd, tryPerUnit: tryPerUsd, sourceDate, sourceHour, publishedAt };
};
const parseTcmbHourlyUsd = xml => {
  const rate = parseTcmbHourlyCurrency(xml, 'USD');
  return { base: 'TRY', quote: 'USD', buying: rate.buying, selling: null, tryPerUsd: rate.tryPerUnit, usdPerTry: 1 / rate.tryPerUnit, sourceDate: rate.sourceDate, sourceHour: rate.sourceHour, publishedAt: rate.publishedAt };
};

const requestXml = url => new Promise((resolve, reject) => {
  const request = https.get(url, { headers: { 'User-Agent': 'NodeCRM/1.0', Accept: 'application/xml,text/xml' } }, response => {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      response.resume();
      const error = new Error(`TCMB request failed with ${response.statusCode}`);
      error.statusCode = response.statusCode;
      return reject(error);
    }
    let body = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { body += chunk; });
    response.on('end', () => resolve(body));
  });
  request.setTimeout(8000, () => request.destroy(new Error('TCMB request timed out')));
  request.on('error', reject);
});

const istanbulParts = date => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
}).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));

const hourlyCandidates = (now = new Date()) => {
  const local = istanbulParts(now);
  const istanbulNow = new Date(`${local.year}-${local.month}-${local.day}T12:00:00Z`);
  const currentHour = Number(local.hour);
  const candidates = [];
  for (let daysBack = 0; daysBack < 8; daysBack += 1) {
    const date = new Date(istanbulNow);
    date.setUTCDate(date.getUTCDate() - daysBack);
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const latest = daysBack === 0 && currentHour >= 10 && currentHour < 15 ? currentHour : 15;
    for (let hour = latest; hour >= 10; hour -= 1) {
      candidates.push(`${HOURLY_BASE_URL}/${year}${month}/${day}${month}${year}-${String(hour).padStart(2, '0')}00.xml`);
    }
  }
  return candidates;
};

const getLatestHourly = async () => {
  for (const url of hourlyCandidates()) {
    try {
      const xml = await requestXml(url);
      const usd = parseTcmbHourlyUsd(xml);
      const eur = parseTcmbHourlyCurrency(xml, 'EUR');
      return { ...usd, tryPerEur: eur.tryPerUnit };
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }
  }
  throw new Error('No recent hourly TCMB rate is available');
};

const getTryUsdRate = async () => {
  const now = Date.now();
  if (cached && now - cached.cachedAt < CACHE_MS) return { ...cached.value, stale: false };
  try {
    let value;
    try {
      value = { ...await getLatestHourly(), source: 'TCMB hourly', fetchedAt: new Date().toISOString() };
    } catch (hourlyError) {
      const xml = await requestXml(SOURCE_URL);
      const usd = parseTcmbUsd(xml);
      const eur = parseTcmbCurrency(xml, 'EUR');
      value = { ...usd, tryPerEur: eur.tryPerUnit, source: 'TCMB daily', fetchedAt: new Date().toISOString() };
    }
    cached = { value, cachedAt: now };
    return { ...value, stale: false };
  } catch (error) {
    if (cached) return { ...cached.value, stale: true };
    throw error;
  }
};

module.exports = { getTryUsdRate, parseTcmbUsd, parseTcmbHourlyUsd, hourlyCandidates };
