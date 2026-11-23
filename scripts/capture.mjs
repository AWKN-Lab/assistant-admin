import { chromium } from 'playwright-core';
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
// P0 修复：截图写入前主动创建目标目录；首次运行缺 docs/screenshots/ 时不再失败。
// 负控：截图后逐张核查文件存在且非空，缺失/空文件一律失败关闭。
const SCREENSHOT_DIR = resolve('docs/screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });
if (!existsSync(SCREENSHOT_DIR)) throw new Error('cannot create docs/screenshots');
const base=process.env.SCREENSHOT_BASE_URL||'http://127.0.0.1:28088';
let server;
if(!process.env.SCREENSHOT_BASE_URL){server=spawn('npm',['run','dev','--','--port','28088','--strictPort'],{stdio:'pipe',shell:process.platform==='win32'});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 let available=false;
 for(let i=0;i<80;i++){try{const r=await fetch(base);if(r.ok){available=true;break;}}catch{}await sleep(200);}
 if(!available)throw Error('Vite preview did not start at '+base);
 const chromePath=process.env.CHROME_PATH||(process.platform==='win32'?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':'/usr/bin/chromium');
 const browser=await chromium.launch({headless:true,executablePath:chromePath,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results=[];
 try{
  for(const demo of ['normal','globalOff','forceOff','loadError']){
   const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1,locale:'zh-CN'});
   const problems=[];const outgoing=[];
   page.on('pageerror',e=>problems.push(e.message));
   page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))outgoing.push(r.url());});
   await page.goto(`${base}/workbench/admin/assistant?demo=${demo}&role=system_admin`,{waitUntil:'networkidle'});
   const marker=demo==='loadError'?'[data-testid="load-error"]':demo==='forceOff'?'[data-testid="force-off-banner"]':'[data-testid="admin-page"]';
   await page.waitForSelector(marker,{timeout:10000});
   if(demo==='normal')await page.waitForSelector('[data-testid="tool-row-t6"]',{timeout:10000});
   if(demo==='globalOff'){const x=await page.locator('[data-testid="effective-state"]').first().innerText();if(!x.includes('全局关闭'))throw Error('globalOff state missing');}
   if(demo==='forceOff'){const x=await page.locator('[data-testid="force-off-banner"]').innerText();if(!x.includes('已被环境变量强制关闭'))throw Error('forceOff banner missing');}
   if(problems.length||outgoing.length)throw Error(`${demo}: runtime errors ${problems.join(';')} external ${outgoing.join(';')}`);
   await page.evaluate(()=>window.scrollTo(0,0));
   const rel=`docs/screenshots/${demo}.png`;const path=resolve(rel);await page.screenshot({path,fullPage:false});
   const {size}=statSync(path);results.push({demo,path:rel,viewport:'1440x960',fullPage:false,bytes:size,errors:problems,externalRequests:outgoing,markerFound:true});
   await page.close();
  }
 }finally{await browser.close();}
 // 负控：四张截图必须全部存在且非空，否则失败关闭（空目录/缺图不算通过）。
 for (const demo of ['normal','globalOff','forceOff','loadError']) {
   const p = resolve(`docs/screenshots/${demo}.png`);
   if (!existsSync(p) || statSync(p).size === 0) throw Error(`${demo}: screenshot missing or empty: ${p}`);
 }
 mkdirSync('docs',{recursive:true});writeFileSync('docs/screenshot-receipt.json',JSON.stringify({capturedAt:new Date().toISOString(),browser:'chromium',results},null,2));
 console.log('PASS',results.length,'real Chromium screenshots; external requests 0; page errors 0');
}catch(e){console.error('FAIL screenshot:',e);process.exitCode=1;}
finally{
 if(server){
   try{if(process.platform==='win32')execSync(`taskkill /pid ${server.pid} /T /F`,{stdio:'ignore'});else server.kill('SIGTERM');}catch{}
 }
 process.exit(process.exitCode ?? 0);
}
