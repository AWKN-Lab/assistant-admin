import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const skipDirs = new Set(['node_modules', 'dist', '.npm-cache', '.git']);
const textExt = new Set(['.md', '.json', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.html', '.css', '.log', '.yml', '.yaml', '.txt', '.lock', '.gitignore', '']);

const patterns = [
  ['KEY_cph', /cph_[A-Za-z0-9]{6,}/g],
  ['KEY_sk', /\bsk-[A-Za-z0-9_-]{12,}/g],
  ['KEY_ghp', /\bghp_[A-Za-z0-9]{16,}/g],
  ['KEY_github_pat', /github_pat_[A-Za-z0-9_]{16,}/g],
  ['KEY_aws', /\bAKIA[0-9A-Z]{12,}/g],
  ['KEY_private', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ['IP_134_179_161', /8\.134\.179\.161/g],
  ['IP_148_245_29', /8\.148\.245\.29/g],
  ['IP_PRIVATE_10', /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g],
  ['IP_PRIVATE_192', /\b192\.168\.\d{1,3}\.\d{1,3}\b/g],
  ['IP_PRIVATE_172', /\b172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/g],
  ['PATH_home_linux', /\/home\/[A-Za-z0-9_.-]+/g],
  ['PATH_users', /[A-Za-z]:\\\\?Users\\\\?[A-Za-z0-9_.-]+|\/Users\/[A-Za-z0-9_.-]+/g],
  ['PATH_clawhunt_home', /~\/\.?clawhunt[-A-Za-z0-9_/]*/g],
  ['AGENT_ID_1642', /\b1642\b/g],
  ['BID_ID_22144', /\b22144\b/g],
  ['EMAIL', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ['URL_chatgpt_plugin', /chatgpt\.com\/plugins/g],
  ['INTERNAL_SPACES', new RegExp('zz_managed' + '_internal' + '_spaces', 'g')],
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const hits = [];
const nonAscii = [];
for (const full of walk(root)) {
  const rel = relative(root, full).replace(/\\/g, '/');
  if (/[^\x20-\x7E]/.test(rel)) nonAscii.push(rel);
  const ext = nameExt(rel);
  if (!textExt.has(ext)) continue;
  let text;
  try {
    text = readFileSync(full, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    for (const [name, re] of patterns) {
      re.lastIndex = 0;
      const m = re.exec(lines[i]);
      if (!m) continue;
      const value = m[0];
      const masked = value.length <= 8 ? value.slice(0, 2) + '***' : value.slice(0, 6) + '***';
      hits.push(`${name} ${rel}:${i + 1} ${masked}`);
    }
  }
}

function nameExt(rel) {
  const base = rel.split('/').pop() ?? '';
  if (base === '.gitignore') return '.gitignore';
  const idx = base.lastIndexOf('.');
  return idx >= 0 ? base.slice(idx).toLowerCase() : '';
}

console.log(`FILES_SCANNED=${walk(root).length} SECRET_HITS=${hits.length} NON_ASCII_NAMES=${nonAscii.length}`);
for (const line of hits) console.log('HIT ' + line);
for (const name of nonAscii) console.log('NON_ASCII ' + name);
process.exitCode = hits.length || nonAscii.length ? 1 : 0;
