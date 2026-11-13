#!/usr/bin/env node
/** Stage 9: browser interaction smoke on generated noindex EN, no design QA. */
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {chromium} from 'playwright-core';
const root=path.resolve(process.argv[2]??'../en-pages-site');
const output=path.resolve(process.argv[3]??'../stage9-browser-interactions.json');
if(!fs.existsSync(path.join(root,'en/index.html')))throw Error('Missing EN output');
const prefix='/adatours-en/';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json',
 '.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.wasm':'application/wasm'};
const server=createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url??'/', 'http://127.0.0.1').pathname);}
 catch{res.writeHead(400).end();return;}
 if(!pathname.startsWith(prefix)){res.writeHead(404).end();return;}
 let file=path.resolve(root,pathname.slice(prefix.length));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(!path.extname(file))file=path.join(file,'index.html');
 fs.stat(file,(err,stat)=>{
  if(err||!stat.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'content-type':MIME[path.extname(file)]??'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
 });
});
const listen=()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address().port));});
const results=[],jsErrors=[],httpErrors=[],cyr=/[\u0400-\u052f]/u;
async function check(name,fn){
 try{results.push({name,status:'passed',details:await fn()});}
 catch(e){results.push({name,status:'failed',error:String(e).slice(0,800)});}
}
let browser;
try{
 const port=await listen(),host='http://127.0.0.1:'+port;
 const home=host+prefix+'en/';
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1280,height:850}});
 await context.route('**/*',route=>route.request().url().startsWith(host+'/')?route.continue():route.abort());
 const page=await context.newPage();
 page.on('pageerror',e=>jsErrors.push(String(e).slice(0,300)));
 page.on('response',r=>{if(r.url().startsWith(host+'/')&&r.status()>=400)httpErrors.push({status:r.status(),url:r.url().slice(host.length)});});
 await check('noindex English home',async()=>{
  await page.goto(home,{waitUntil:'domcontentloaded',timeout:25000});
  const lang=await page.locator('html').getAttribute('data-ada-shared-locale');
  const robots=await page.locator('meta[name="robots"]').getAttribute('content');
  const schema=await page.locator('script[type="application/ld+json"]').count();
  if(lang!=='en'||!robots?.includes('noindex')||schema!==1)throw Error('Invalid EN/noindex/schema markers');
  return {lang,robots,schema};
 });
 await check('search and filter interaction',async()=>{
  await page.locator('[data-search-open]:visible').first().click({timeout:12000});
  const input=page.locator('#site-search-input');
  await input.waitFor({state:'visible',timeout:12000});await input.fill('Rio');
  await page.waitForTimeout(1500);
  const filter=page.locator('[data-search-filter="tour"]:visible').first();
  if(await filter.count())await filter.click({timeout:8000});
  await page.waitForTimeout(300);
  const status=(await page.locator('[data-search-status]').first().innerText()).trim();
  if(!status||cyr.test(status))throw Error('Missing or Russian search status: '+status);
  return {status,pressed:await filter.count()?await filter.getAttribute('aria-pressed'):null};
 });
 await check('catalogue load-more interaction',async()=>{
  await page.goto(home+'tours/',{waitUntil:'domcontentloaded',timeout:20000});
  const panel=page.locator('[data-catalog-root]').first();
  const before=await panel.locator('[data-catalog-item]').count();
  if(before!==30)throw Error('Expected 30, got '+before);
  await panel.locator('[data-catalog-load-more]').click({timeout:12000});
  await page.waitForFunction(()=>document.querySelectorAll('[data-catalog-root] [data-catalog-item]').length>=60,null,{timeout:15000});
  const after=await panel.locator('[data-catalog-item]').count();
  const status=(await panel.locator('[data-catalog-status]').innerText()).trim();
  if(after<60||cyr.test(status))throw Error('Load-more or status failed');
  return {before,after,status};
 });
 await check('multi-country picker navigation',async()=>{
  await page.goto(home+'multi-country/',{waitUntil:'domcontentloaded',timeout:20000});
  await page.locator('select[data-mc-select="0"]').selectOption('brazil',{timeout:8000});
  await page.waitForFunction(()=>[...document.querySelectorAll('select[data-mc-select="1"] option')].some(e=>e.value==='argentina'),null,{timeout:10000});
  await page.locator('select[data-mc-select="1"]').selectOption('argentina',{timeout:10000});
  await page.waitForURL(/\/multi-country\/argentina_brazil\//,{timeout:15000});
  return {route:page.url().slice(host.length)};
 });
 await check('tour accordion interaction',async()=>{
  await page.goto(home+'brazil/tour/amazing-brazil/',{waitUntil:'domcontentloaded',timeout:20000});
  const details=page.locator('details.day').first(),before=await details.getAttribute('open');
  await details.locator('summary').click({timeout:10000});
  const after=await details.getAttribute('open');
  if((before===null)===(after===null))throw Error('Day accordion did not toggle');
  return {days:await page.locator('details.day').count(),opened:after!==null};
 });
 await check('lead-form empty submission',async()=>{
  const form=page.locator('[data-lead-form]').first();
  await form.scrollIntoViewIfNeeded({timeout:10000});
  await form.locator('button[type="submit"]').click({timeout:12000});
  await page.waitForTimeout(300);
  const msg=(await form.locator('[data-lead-status]').innerText()).trim();
  const invalid=await form.locator(':invalid').count();
  if(cyr.test(msg)||(!msg&&!invalid))throw Error('Missing English form validation: '+msg);
  return {message:msg,invalid};
 });
 await check('mobile hamburger menu',async()=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(home,{waitUntil:'domcontentloaded',timeout:20000});
  const button=page.locator('[data-menu-toggle]:visible').first();
  await button.click({timeout:12000});
  const expanded=await button.getAttribute('aria-expanded');
  if(expanded!=='true')throw Error('Mobile menu did not open');
  return {expanded,label:await button.getAttribute('aria-label')};
 });
 await context.close();
}catch(e){results.push({name:'browser infrastructure',status:'failed',error:String(e).slice(0,800)});}
finally{try{await browser?.close();}catch{}if(server.listening)await new Promise(resolve=>server.close(resolve));}
const report={schemaVersion:1,sourceSha:process.env.ADA_CANONICAL_SHA??null,
 type:'EN Stage 9 generated-site JS interactions (not Pages deployment)',
 checks:results,passed:results.filter(x=>x.status==='passed').length,
 failed:results.filter(x=>x.status==='failed').length,
 jsErrors:jsErrors.slice(0,25),localHttpErrors:httpErrors.slice(0,25),checkedAt:new Date().toISOString()};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log('EN stage9 browser interactions: '+JSON.stringify({passed:report.passed,failed:report.failed,errors:results.filter(x=>x.status==='failed')}));
if(report.failed)process.exitCode=1;
