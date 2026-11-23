import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const manifestPath = join(root, 'MANIFEST.sha256');
const skipDirs = new Set(['node_modules', 'dist', '.npm-cache', '.git']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    if (name === 'MANIFEST.sha256' || name.endsWith('.tsbuildinfo')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const expected = new Map();
for (const line of readFileSync(manifestPath, 'utf8').split(/\r?\n/)) {
  if (!line.trim()) continue;
  const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
  if (!m) {
    console.error('BAD_LINE ' + line);
    process.exit(1);
  }
  expected.set(m[2], m[1]);
}

const actualFiles = walk(root)
  .map((full) => ({ full, rel: relative(root, full).replace(/\\/g, '/') }))
  .sort((a, b) => (a.rel < b.rel ? -1 : 1));

let ok = 0;
const problems = [];
for (const { full, rel } of actualFiles) {
  const want = expected.get(rel);
  if (!want) {
    problems.push('UNLISTED ' + rel);
    continue;
  }
  const got = createHash('sha256').update(readFileSync(full)).digest('hex');
  if (got !== want) problems.push(`MISMATCH ${rel} want=${want.slice(0, 12)} got=${got.slice(0, 12)}`);
  else ok += 1;
}
for (const rel of expected.keys()) {
  if (!actualFiles.some((f) => f.rel === rel)) problems.push('MISSING ' + rel);
}

console.log(`MANIFEST_VERIFIED=${ok} EXPECTED=${expected.size} PROBLEMS=${problems.length}`);
for (const p of problems) console.log('PROBLEM ' + p);
process.exitCode = problems.length ? 1 : 0;
