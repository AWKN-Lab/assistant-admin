import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
const dir = resolve('dist')
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff'}
const server=createServer(async(req,res)=>{try{const p=new URL(req.url,'http://x').pathname;let f=resolve(dir,'.'+p);if(!f.startsWith(dir+'/')&&f!==dir)throw Error('path');if(!extname(f))f=resolve(dir,'index.html');res.setHeader('Content-Type',types[extname(f)]||'application/octet-stream');res.end(await readFile(f))}catch{res.writeHead(404);res.end('nf')}})
await new Promise(r=>server.listen(28089,'127.0.0.1',r))
const base='http://127.0.0.1:28089'
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox']})
const page=await browser.newPage({viewport:{width:1440,height:960}})
const out=[]
const cases=[
 ['normal','?role=system_admin&demo=normal'],
 ['globalOff','?role=system_admin&demo=globalOff'],
 ['forceOff','?role=system_admin&demo=forceOff'],
 ['loadError','?role=system_admin&demo=loadError'],
 ['forbidden-operator','?role=operator&demo=normal'],
 ['forbidden-no-role','?demo=normal'],
]
for(const [name,q] of cases){
  const errs=[]; const ext=[]
  page.on('pageerror',e=>errs.push(String(e)))
  page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))ext.push(r.url())})
  await page.goto(base+'/workbench/admin/assistant'+q,{waitUntil:'networkidle'})
  await page.waitForTimeout(300)
  const info=await page.evaluate(()=>{
    const tids=[...document.querySelectorAll('[data-testid]')].map(e=>e.getAttribute('data-testid'))
    const body=(document.body.innerText||'').split('\n').map(s=>s.trim()).filter(Boolean)
    return {pathname:location.pathname+location.search, testids:[...new Set(tids)], text:body}
  })
  out.push({name, url:base+'/workbench/admin/assistant'+q, pathname:info.pathname, testids:info.testids, pageErrors:errs, externalRequests:ext, domText:info.text})
}
await browser.close(); await new Promise(r=>server.close(r))
const fs=await import('node:fs/promises');
const L=[];for(const c of out){L.push('='.repeat(72),'## '+c.name,'URL: '+c.url,'最终 pathname: '+c.pathname,'页面错误数: '+c.pageErrors.length+'   外部请求数: '+c.externalRequests.length,'--- DOM 实际渲染文本（逐行）---',...c.domText,'')}
await fs.writeFile('evidence/dom.log',L.join('\n')+'\n');
if(out.some(c=>c.pageErrors.length||c.externalRequests.length))process.exit(1);
console.log('DOM_DUMP_OK states='+out.length);
