// Populate IIS's compressed static-file cache without downloading private data.
const fs = require('node:fs/promises');
const path = require('node:path');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;

async function main() {
  const origin = option('--origin', 'https://37.148.206.74');
  const release = path.resolve(option('--release-dir', path.join(__dirname, '../client/build')));
  const manifest = JSON.parse(await fs.readFile(path.join(release, 'asset-manifest.json'), 'utf8'));
  const assets = [...new Set(Object.values(manifest.files).filter(file => /^\/static\/[^?]+\.(js|css)$/.test(file)))];
  let cursor = 0, compressed = 0;
  await Promise.all(Array.from({ length: Math.min(4, assets.length) }, async () => {
    while (cursor < assets.length) {
      const asset = assets[cursor++];
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetch(origin + asset, { headers: { 'Accept-Encoding': 'gzip' }, signal: AbortSignal.timeout(30000) });
        if (response.status !== 200) throw new Error('Release asset unavailable: ' + asset);
        await response.arrayBuffer();
        if (response.headers.get('content-encoding')?.includes('gzip')) { compressed++; break; }
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }));
  console.log(JSON.stringify({ staticAssetsWarmed: assets.length, gzipResponses: compressed }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
