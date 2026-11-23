import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const outFile = join(root, 'MANIFEST.sha256');
const skipDirs = new Set(['node_modules', 'dist', '.npm-cache', '.git']);
const skipFiles = new Set(['MANIFEST.sha256']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    if (skipFiles.has(name)) continue;
    if (name.endsWith('.tsbuildinfo')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(root)
  .map((full) => ({ full, rel: relative(root, full).replace(/\\/g, '/') }))
  .sort((a, b) => (a.rel < b.rel ? -1 : 1));

for (const f of files) {
  if (/[^\x20-\x7E]/.test(f.rel)) {
    console.error('NON_ASCII_PATH ' + f.rel);
    process.exit(1);
  }
}

const lines = files.map((f) => {
  const hash = createHash('sha256').update(readFileSync(f.full)).digest('hex');
  return `${hash}  ${f.rel}`;
});
writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');
const bytes = files.reduce((sum, f) => sum + statSync(f.full).size, 0);
console.log(`MANIFEST_FILES=${files.length} MANIFEST_BYTES=${bytes} MANIFEST=MANIFEST.sha256`);
console.log(`MANIFEST_SHA256=${createHash('sha256').update(readFileSync(outFile)).digest('hex')}`);
