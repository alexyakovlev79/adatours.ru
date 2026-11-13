#!/usr/bin/env node
/** Real Chromium checks of visitor actions on the noindex EN build.
 * No screenshots or visual QA (those belong to stage 10).
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {once} from 'node:events';
import {strict as assert} from 'node:assert';
import {chromium} from 'playwright';
const root=path.resolve(process.argv[2]??'../en-pages-site');
const output=path.resolve(process.argv[3]??'../stage9-interactions.json');
const base='/adatours-en/';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1');
  if(!u.pathname.startsWith(base))throw Error('Outside staging base');
  let file=path.resolve(root,decodeURIComponent(u.pathname.slice(base.length)));
  if(file!==root&&!file.startsWith(root+path.sep))throw Error('Traversal');
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
 }catch(error){res.writeHead(400);res.end(String(error.message));}
});
const tests=[],runtimeErrors=[];
let browser=null;
const check=async(name,fn)=>{
 try{const v=await fn();tests.push({name,status:v?.skip?'skipped':'passed',...v});}
 catch(e){tests.push({name,status:'failed',error:String(e.stack??e).slice(0,650)});}
 console.log('Stage 9 interaction: '+JSON.stringify(tests.at(-1)));
};
try{
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const open=async(route,width=1280)=>{
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(13000);
  page.on('pageerror',e=>runtimeErrors.push({route,error:e.message.slice(0,220)}));
  await page.route('**/*',r=>{
   try{if(new URL(r.request().url()).origin===origin)return r.continue();}catch{}
   return r.abort('blockedbyclient');
  });
  const response=await page.goto(origin+base+route.replace(/^\//,''),{waitUntil:'domcontentloaded',timeout:35000});
  assert.equal(response?.status(),200,'Route missing: '+route);
  assert.equal(await page.locator('html').getAttribute('data-ada-shared-locale'),'en');
  assert.match(await page.locator('meta[name=robots]').getAttribute('content'),/noindex/);
  const accept=page.locator('[data-cookie-accept]');
  if(await accept.isVisible().catch(()=>false))await accept.click();
  return {page,context};
 };
 await check('catalog-show-more',async()=>{
  const {page,context}=await open('/en/tours/');
  try{
   const count=page.locator('[data-catalog-count]').first(), more=page.locator('[data-catalog-load-more]').first();
   const before=await count.innerText();
   await more.click();
   await page.waitForFunction(old=>document.querySelector('[data-catalog-count]')?.textContent!==old,before,{timeout:19000});
   const after=await count.innerText(),status=await page.locator('[data-catalog-status]').first().innerText();
   assert.doesNotMatch(after+status,/[А-Яа-яЁё]/u);
   return {before,after,status};
  }finally{await context.close();}
 });
 await check('mobile-menu-and-submenu',async()=>{
  const {page,context}=await open('/en/tours/',390);
  try{
   const toggle=page.locator('[data-menu-toggle]');await toggle.click();
   assert.equal(await toggle.getAttribute('aria-expanded'),'true');
   const submenu=page.locator('[data-submenu-open]:visible').first();
   if(await submenu.count()){
    await submenu.click();assert.equal(await submenu.getAttribute('aria-expanded'),'true');
    const back=page.locator('[data-submenu-back]:visible').first();
    if(await back.count())await back.click();
   }
   await page.keyboard.press('Escape');
   assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   const label=await toggle.getAttribute('aria-label');assert.doesNotMatch(label??'',/[А-Яа-яЁё]/u);
   return {opened:true,closedByEscape:true,label};
  }finally{await context.close();}
 });
 await check('search-overlay-and-filter',async()=>{
  const {page,context}=await open('/en/tours/');
  try{
   await page.locator('[data-search-open]:visible').first().click();
   const overlay=page.locator('[data-search-overlay]');
   assert.equal(await overlay.getAttribute('aria-hidden'),'false');
   const filter=overlay.locator('[data-search-filter=destination]');await filter.click();
   assert.equal(await filter.getAttribute('aria-pressed'),'true');
   const label=await filter.innerText();assert.doesNotMatch(label,/[А-Яа-яЁё]/u);
   await overlay.locator('[data-search-close]').click();
   assert.equal(await overlay.getAttribute('aria-hidden'),'true');
   return {filter:label,opened:true,closed:true};
  }finally{await context.close();}
 });
 await check('multi-country-selection',async()=>{
  const {page,context}=await open('/en/multi-country/');
  try{
   const selects=page.locator('[data-mc-select]');assert.ok(await selects.count()>=2);
   const first=selects.first(), opts=await first.locator('option').evaluateAll(x=>x.map(y=>y.value).filter(Boolean));
   const a=opts.includes('brazil')?'brazil':opts[0];assert.ok(a);
   await first.selectOption(a);
   const second=selects.nth(1);
   const more=await second.locator('option').evaluateAll(x=>x.map(y=>y.value).filter(Boolean));
   assert.ok(more.length);await second.selectOption(more[0]);
   await page.waitForURL(/\/en\/multi-country\/[^/]*_[^/]*\//,{timeout:20000});
   const label=await page.locator('[data-mc-select]').first().locator('option').first().innerText();
   assert.doesNotMatch(label,/[А-Яа-яЁё]/u);
   return {first:a,second:more[0],page:page.url().replace(origin,'')};
  }finally{await context.close();}
 });
 await check('tour-day-accordion',async()=>{
  const {page,context}=await open('/en/argentina/tour/aconcagua-trek/');
  try{
   const day=page.locator('details.day').first();assert.ok(await day.count());
   if(await day.evaluate(e=>e.open))await day.locator('summary').click();
   await day.locator('summary').click();assert.equal(await day.evaluate(e=>e.open),true);
   await day.locator('summary').click();assert.equal(await day.evaluate(e=>e.open),false);
   return {expanded:true,collapsed:true};
  }finally{await context.close();}
 });
 await check('seo-details-toggle',async()=>{
  const {page,context}=await open('/en/brazil/rio-de-janeiro/corcovado-four-hours/tour/');
  try{
   const btn=page.locator('[data-seo-geo-toggle]:visible').first();
   if(!await btn.count())return {skip:true,reason:'Article is not long enough for a toggle'};
   const text=await btn.locator('[data-seo-geo-label]').innerText();assert.doesNotMatch(text,/[А-Яа-яЁё]/u);
   await btn.click();assert.equal(await btn.getAttribute('aria-expanded'),'true');
   const now=await btn.locator('[data-seo-geo-label]').innerText();assert.doesNotMatch(now,/[А-Яа-яЁё]/u);
   return {collapsed:text,expanded:now};
  }finally{await context.close();}
 });
 await check('noindex-form-cannot-submit',async()=>{
  const {page,context}=await open('/en/contacts/');
  try{
   assert.equal(await page.locator('form[data-lead-form]').count(),0);
   const count=await page.locator('button[type=submit]').count();
   for(let i=0;i<count;i++)assert.ok(await page.locator('button[type=submit]').nth(i).isDisabled());
   return {liveForms:0,disabledSubmitButtons:count};
  }finally{await context.close();}
 });
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
const summary={schemaVersion:1,mode:'browser-user-action-check-not-visual-qa',
 scenarios:tests,jsRuntimeErrors:runtimeErrors,passed:tests.filter(x=>x.status==='passed').length,
 failed:tests.filter(x=>x.status==='failed').length,skipped:tests.filter(x=>x.status==='skipped').length,
 at:new Date().toISOString()};
fs.writeFileSync(output,JSON.stringify(summary,null,2)+'\n');
console.log('Stage 9 interaction summary: '+JSON.stringify({passed:summary.passed,failed:summary.failed,
 skipped:summary.skipped,pageErrors:runtimeErrors.length}));
if(summary.failed||runtimeErrors.length)process.exitCode=1;
