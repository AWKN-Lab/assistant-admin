import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const srcDir = join(root, 'src');
const cssPath = join(root, 'src', 'styles.css');

const used = new Set();
for (const file of readdirSync(srcDir).filter((f) => /\.(tsx|jsx)$/.test(f))) {
  const text = readFileSync(join(srcDir, file), 'utf8');
  const re = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = (m[1] ?? m[2] ?? '').replace(/\$\{[^}]*\}/g, ' ');
    for (const token of raw.split(/\s+/)) {
      if (token && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(token)) used.add(token);
    }
  }
}

const css = readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const defined = new Set();
const blockRe = /([^{}]+)\{/g;
let b;
while ((b = blockRe.exec(css))) {
  const selectors = b[1];
  if (selectors.includes('@')) continue;
  const classRe = /\.([A-Za-z_][A-Za-z0-9_-]*)/g;
  let c;
  while ((c = classRe.exec(selectors))) defined.add(c[1]);
}

const missing = [...used].filter((name) => !defined.has(name)).sort();
const unused = [...defined].filter((name) => !used.has(name) && !name.startsWith('t-')).sort();

console.log(`USED=${used.size} DEFINED=${defined.size} UNDEFINED=${missing.length}`);
if (missing.length) console.log('UNDEFINED_CLASSES=' + missing.join(','));
if (unused.length) console.log('UNUSED_CLASSES=' + unused.join(','));
process.exitCode = missing.length ? 1 : 0;
