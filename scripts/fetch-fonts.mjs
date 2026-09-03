// Downloads the latin-subset woff2 files for Inter and JetBrains Mono from
// Google Fonts and emits @font-face rules for public/fonts/. One-off helper;
// output is committed so the app never needs the network for fonts.
// Run: node scripts/fetch-fonts.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'fonts');
mkdirSync(outDir, { recursive: true });

const CSS_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const css = await (await fetch(CSS_URL, { headers: { 'User-Agent': UA } })).text();

const blocks = [...css.matchAll(/\/\* ([\w-]+) \*\/\s*@font-face\s*\{([^}]+)\}/g)];
const faces = [];
for (const [, subset, body] of blocks) {
  if (subset !== 'latin') continue;
  const family = body.match(/font-family:\s*'([^']+)'/)?.[1];
  const weight = body.match(/font-weight:\s*(\d+)/)?.[1];
  const url = body.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  if (!family || !weight || !url) continue;
  const file = `${family.replace(/ /g, '')}-${weight}.woff2`;
  const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  writeFileSync(join(outDir, file), buf);
  faces.push(
    `@font-face {\n  font-family: '${family}';\n  font-style: normal;\n  font-weight: ${weight};\n  font-display: swap;\n  src: url('/fonts/${file}') format('woff2');\n}`
  );
  console.log(`${file}  (${buf.length} bytes)`);
}

writeFileSync(join(outDir, 'fontfaces.css'), faces.join('\n\n') + '\n');
console.log(`\n${faces.length} @font-face rules written to public/fonts/fontfaces.css`);
