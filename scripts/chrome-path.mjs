// 共用：定位一个可用的 Chromium/Chrome 可执行文件。
// 为什么单独抽出来：`check-glyphs.mjs`（中文字形守卫）与 `dump-dom.mjs`（DOM 证据转储）
// 都要启动浏览器，而 playwright 的安装布局会随版本变：
//   chromium-1148 → chrome-linux/chrome      chromium-1255 → chrome-linux64/chrome
// ⇒ 写死一种布局等于"playwright 一升级守卫就找不到浏览器"（真事：2026-11-25 在 #1888 仓实测）。
// 找不到时返回空串，由调用方**非零退出**（绝不静默假绿）。
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LAYOUTS = [
  'chrome-linux/chrome',
  'chrome-linux/headless_shell',
  'chrome-linux64/chrome',
  'chrome-linux64/headless_shell',
  'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  'chrome-win/chrome.exe',
];

const SYSTEM_PATHS = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/local/bin/chromium',
  '/usr/local/bin/google-chrome',
  '/opt/google/chrome/chrome',
  '/snap/bin/chromium',
];

export function resolveChromePath(env = process.env) {
  const explicit = env.CHROME_PATH || env.CHROMIUM_PATH;
  if (explicit) return explicit;
  if (process.platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }
  const roots = [join(homedir(), '.cache', 'ms-playwright'), '/root/.cache/ms-playwright'];
  const found = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root)) {
      if (!dir.startsWith('chromium')) continue;
      for (const rel of LAYOUTS) {
        const p = join(root, dir, rel);
        if (existsSync(p)) found.push({ p, mtime: statSync(p).mtimeMs });
      }
    }
  }
  found.sort((a, b) => b.mtime - a.mtime);
  if (found.length) return found[0].p;
  for (const sys of SYSTEM_PATHS) {
    if (existsSync(sys)) return sys;
  }
  return '';
}
