import { execSync, spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { resolveChromePath } from './chrome-path.mjs';

const simulate = process.argv.includes('--simulate-notdef');
const base = process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1:28088';
const CJK = ['助', '手', '管', '理', '工', '具', '关', '停', '开'];
const NOTDEF = Array.from({ length: 9 }, (_, i) => String.fromCodePoint(0xe000 + i));
const targets = simulate ? NOTDEF : CJK;
// 浏览器解析：显式环境变量优先，其次 playwright 装出来的构建（**版本号会变 ⇒ 通配找最新**），
// 最后才回落系统 chromium。CI 里 `npx playwright install chromium` 装的就是第二种。
const chromePath = resolveChromePath();
console.log('CHROME_PATH=' + (chromePath || '(not found)'));
if (!chromePath) {
  console.log('GLYPH_CHECK=ERROR no chromium found; set CHROME_PATH or run: npx playwright install chromium');
  process.exit(1);
}

let server;
if (!process.env.SCREENSHOT_BASE_URL) {
  server = spawn('npm', ['run', 'dev', '--', '--port', '28088', '--strictPort'], {
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
}

function stopServer() {
  if (!server) return;
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
    else server.kill('SIGTERM');
  } catch {
    /* already gone */
  }
}

async function waitForServer() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const res = await fetch(`${base}/workbench/admin/assistant?role=system_admin&demo=normal`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('dev server not ready');
}

async function glyphHash(page, ch) {
  return page.evaluate((char) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#000';
    ctx.font = '40px ' + getComputedStyle(document.body).fontFamily;
    ctx.textBaseline = 'top';
    ctx.fillText(char, 8, 8);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    let hash = 2166136261;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      const on = data[i] < 128 ? 1 : 0;
      if (on) ink += 1;
      hash ^= on;
      hash = Math.imul(hash, 16777619);
    }
    return { hash: (hash >>> 0).toString(16), ink };
  }, ch);
}

let browser;
let code = 1;
try {
  await waitForServer();
  let zhFontCount = 'n/a';
  try {
    if (process.platform !== 'win32') {
      zhFontCount = execSync('fc-list :lang=zh 2>/dev/null | wc -l').toString().trim();
    }
  } catch {
    /* fontconfig unavailable */
  }
  console.log('ZH_FONT_COUNT=' + zhFontCount);
  browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(`${base}/workbench/admin/assistant?role=system_admin&demo=normal`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="admin-page"]', { timeout: 15000 }).catch(() => {});

  const notdefRefs = new Set();
  for (const ch of NOTDEF) {
    const h = await glyphHash(page, ch);
    notdefRefs.add(`${h.hash}:${h.ink}`);
  }

  const failures = [];
  for (const ch of targets) {
    const h = await glyphHash(page, ch);
    const key = `${h.hash}:${h.ink}`;
    const missing = notdefRefs.has(key);
    console.log(`GLYPH ${ch} U+${ch.codePointAt(0).toString(16).toUpperCase()} hash=${h.hash} ink=${h.ink} notdef=${missing}`);
    if (missing) failures.push(`U+${ch.codePointAt(0).toString(16)} renders as notdef`);
    if (h.ink < 5) failures.push(`U+${ch.codePointAt(0).toString(16)} has no ink`);
  }

  if (failures.length) {
    console.log('CJK_GLYPH_MISSING=' + failures.length);
    console.log('GLYPH_CHECK=FAIL');
    for (const f of failures) console.log('FAIL ' + f);
    code = 1;
  } else {
    console.log('GLYPH_CHECK=PASS');
    code = 0;
  }
} catch (error) {
  console.log('GLYPH_CHECK=ERROR ' + error.message);
  code = 1;
} finally {
  if (browser) await browser.close();
  stopServer();
}
process.exit(code);
