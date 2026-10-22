#!/usr/bin/env node
/**
 * One-off, idempotent SEO/GEO release: nine approved staging articles, one
 * main content commit, one normal Pages build, and post-deploy registry commit.
 * All large phase JSON changes are made on the GitHub runner, not through API
 * payloads. Never claim an article published before a successful Pages run.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const repo = process.env.GITHUB_REPOSITORY;
const pinned = process.env.SEO_DISPATCH_SHA;
const manifestPath = 'data/seo-geo/release-dispatch/overdue-nine-20261022.json';
const receiptPath = 'data/seo-geo/releases/overdue-nine-20261022.json';
const expected = [
  '/multi-country/guatemala_honduras_mexico_panama/interests/nature/',
  '/multi-country/guatemala_mexico_nicaragua_panama/interests/nature/',
  '/multi-country/honduras_mexico_nicaragua_panama/interests/nature/',
  '/vip/interests/coffee-tours/',
  '/vip/interests/nature/',
  '/interests/coffee-tours/places/',
  '/interests/nature/places/',
  '/interests/coffee-tours/excursions/',
  '/interests/nature/excursions/',
];
const phases = ['05-tours.json', '06-places.json', '07-excursions.json'];
const registryPath = (name) => 'data/seo-geo/registry/' + name;
const articlePath = (url) => 'data/seo-geo/articles' + url + 'index.md';
const provenancePath = (url) => 'data/seo-geo/provenance' + url + 'index.json';
const serial = (obj, sourceText) => JSON.stringify(obj, /^\{\s*\n/.test(sourceText) ? null : undefined,
  /^\{\s*\n/.test(sourceText) ? 2 : undefined) + '\n';
const say = (...args) => console.log('SEO nine:', ...args);
const sh = (command, ...args) => execFileSync(command, args, {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore','pipe','pipe']
}).trimEnd();
const git = (...args) => sh('git', ...args);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const at = (ref, path) => execFileSync('git', ['show', ref + ':' + path], {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
});
const blob = (ref, path) => {
  try { return git('rev-parse', ref + ':' + path); } catch { return null; }
};
const save = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
};
const getReceipt = () => existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : null;
function checkoutRemote(branch, local) {
  git('fetch', '--no-tags', 'origin', branch);
  git('checkout', '-B', local, 'refs/remotes/origin/' + branch);
}
function configuration() {
  git('config','user.name','github-actions[bot]');
  git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com');
}
function readPhases() {
  return phases.map((name) => {
    const path = registryPath(name);
    const original = readFileSync(path, 'utf8');
    return { path, original, doc: JSON.parse(original) };
  });
}
function selectedRow(docs, url) {
  const matching = docs.flatMap((d) => d.doc.entries.filter((r) => r.url === url).map((r) => ({row:r,doc:d})));
  if (matching.length !== 1) throw Error('Expected one canonical registry entry: ' + url + ', got ' + matching.length);
  return matching[0];
}
function updateRows(docs, stage, run = null, releaseSha = null, contentByUrl = new Map()) {
  const changed = new Set();
  for (const url of expected) {
    const {row, doc} = selectedRow(docs,url);
    if (['archived','temporarily_unavailable','missing'].includes(row.availability) ||
        ['archived','temporarily_unavailable'].includes(row.work))
      throw Error('Cannot publish inactive URL: ' + url);
    const file = articlePath(url);
    if (run) {
      if (!['prepared','published','rewritten'].includes(row.work))
        throw Error('Expected prepared row after deploy: ' + url + ' (' + row.work + ')');
      row.work = 'rewritten';
      row.publishedAt ||= new Date(run.created_at).toISOString().slice(0,10);
      row.publishedCommit ||= releaseSha;
      row.deployRun = run.id;
      row.rewrittenAt = new Date().toISOString().slice(0,10);
      row.rewrittenCommit = releaseSha;
      row.rewriteDeployRun = run.html_url;
      row.rewriteSourceBlobSha = contentByUrl.get(url);
      row.rewriteResultBlobSha = contentByUrl.get(url);
      row.rewriteChanges = 0;
    } else {
      if (!['queued','draft','prepared','published','rewritten'].includes(row.work))
        throw Error('Unexpected article work: ' + url + ' (' + row.work + ')');
      if (row.work === 'queued' || row.work === 'draft') row.work = 'prepared';
      row.preparedAt ||= '2026-10-22T10:37:46.000Z';
      row.preparedBy ||= 'seo-overdue-nine-final-release-20261022';
      row.articlePath = file;
    }
    changed.add(doc.path);
  }
  for (const doc of docs) if (changed.has(doc.path)) save(doc.path, serial(doc.doc,doc.original));
  return [...changed];
}
if (!repo || !/^[a-f0-9]{40}$/.test(pinned)) throw Error('Exact staging dispatch SHA required');
configuration();
git('fetch','--no-tags','origin','main','seo-geo/staging');
const manifest = JSON.parse(at(pinned,manifestPath));
if (manifest.mode !== 'publish-overdue-nine' || manifest.batchId !== 'seo-overdue-nine-20261022' ||
    manifest.voiceReviewed !== true || JSON.stringify(manifest.urls) !== JSON.stringify(expected))
  throw Error('Invalid or changed immutable batch manifest');
const shaByUrl = new Map();
for (const url of expected) {
  const md = at(pinned,articlePath(url));
  const pv = JSON.parse(at(pinned,provenancePath(url)));
  if (!md.startsWith('---\n') || !md.includes('\nstatus: approved\n') ||
      !md.includes('\ntargetPath: ' + url + '\n') || !md.includes('\n## ') ||
      pv.targetPath !== url || pv.articlePath !== articlePath(url))
    throw Error('Article/provenance is not approved or mismatched: ' + url);
  shaByUrl.set(url,blob(pinned,articlePath(url)));
}
say('Approved article and evidence pairs verified:', shaByUrl.size);
// First reconcile writer staging so these articles cannot be claimed again.
let stageDone = false;
for (let attempt=1; attempt<=3 && !stageDone; attempt++) {
  checkoutRemote('seo-geo/staging','seo-nine-writer-staging');
  const claims = JSON.parse(readFileSync('data/seo-geo/claims.json','utf8')).claims || {};
  const now = Date.now();
  for (const url of expected) if (claims[url] && Date.parse(claims[url].expiresAt)>now)
    throw Error('An active author still owns ' + url + ': ' + claims[url].ownerId);
  const docs = readPhases();
  const touched = updateRows(docs,false);
  git('add',...touched);
  const modified = git('diff','--cached','--name-only');
  if (!modified) { stageDone=true; say('Writer staging already prepared'); break; }
  git('commit','-m','seo: mark nine approved overdue articles prepared [skip ci]');
  try { git('push','origin','HEAD:refs/heads/seo-geo/staging'); stageDone=true; }
  catch (error) { if (attempt===3) throw error; say('Writer staging moved, retry',attempt); }
}
let releaseSha = null;
let receipt = null;
// One main content commit. On reruns, reuse its immutable receipt.
for (let attempt=1;attempt<=3 && !releaseSha;attempt++) {
  checkoutRemote('main','seo-nine-release-main');
  receipt = getReceipt();
  if (receipt) {
    if (receipt.batchId !== manifest.batchId || receipt.pinnedStagingSha !== pinned)
      throw Error('A different release occupies the receipt path');
    releaseSha = git('log','-1','--format=%H','--',receiptPath);
    say('Resuming existing release',releaseSha,receipt.status);
    if (receipt.status==='completed') process.exit(0);
    break;
  }
  const parent = git('rev-parse','HEAD');
  const docs = readPhases();
  updateRows(docs,false);
  const files=[];
  for (const url of expected) {
    for (const file of [articlePath(url),provenancePath(url)]) {
      const value=at(pinned,file);
      const current=blob('HEAD',file);
      if (current && current!==blob(pinned,file))
        throw Error('Existing main content differs: '+file);
      if (!current) save(file,value);
      files.push(file);
    }
  }
  const now=new Date().toISOString();
  receipt={version:1,batchId:manifest.batchId,status:'deploying',
    createdAt:now,pinnedStagingSha:pinned,sourceMainHead:parent,
    voiceReviewed:true,urls:expected,
    articleBlobs:Object.fromEntries(shaByUrl)};
  save(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  git('add',...files,...phases.map(registryPath),receiptPath);
  git('commit','-m','seo: publish all nine overdue approved articles in one Pages release');
  const commit=git('rev-parse','HEAD');
  try { git('push','origin','HEAD:refs/heads/main');releaseSha=commit; }
  catch(error) { if(attempt===3)throw error;say('Main advanced, retry',attempt); }
}
if (!releaseSha) throw Error('Could not create or recover release');
const releasesUrl = 'repos/'+repo+'/actions/workflows/deploy.yml/runs?branch=main&event=workflow_dispatch&per_page=100';
const listRuns=()=>JSON.parse(sh('gh','api',releasesUrl)).workflow_runs||[];
const eligible = (r) => r.head_sha === releaseSha &&
  Date.parse(r.created_at) >= Date.parse(receipt.createdAt)-120000;
let run=listRuns().find(eligible);
if (!run) {
  say('Dispatching one normal Pages deployment for',releaseSha);
  sh('gh','workflow','run','deploy.yml','--ref','main');
}
let result=null;
const deadline=Date.now()+43*60*1000;
while(Date.now()<deadline) {
  const rows=listRuns();
  run=rows.filter(eligible).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at))[0]||null;
  if (run) {
    if (run.status === 'completed') { result=run; break; }
    say('Pages',run.id,run.status);
  }
  await wait(20000);
}
if (!result) throw Error('Pages deploy still pending; receipt is preserved for exact resumption');
if (result.conclusion!=='success') throw Error('Pages deploy did not succeed: '+result.html_url+' ('+result.conclusion+')');
say('Pages success',result.html_url);
// Verify the deployed commit contains each exact new article blob.
git('fetch','--no-tags','origin','main');
try { git('cat-file','-e',result.head_sha+'^{commit}'); }
catch { throw Error('Cannot inspect exact published Pages SHA '+result.head_sha); }
for(const url of expected) if(blob(result.head_sha,articlePath(url))!==shaByUrl.get(url))
  throw Error('Deployed article bytes differ: '+url);
const completed = {...receipt,status:'completed',deployedAt:new Date().toISOString(),
  publishedCommit:releaseSha,deployRun:result.id,deployUrl:result.html_url,
  sourceContentSha:result.head_sha};
// Post-deploy metadata only, no second Pages run.
let finalMain=false;
for(let attempt=1;attempt<=3 && !finalMain;attempt++) {
  checkoutRemote('main','seo-nine-final-main');
  const previous=getReceipt();
  if (previous?.status==='completed') {finalMain=true;break;}
  const docs=readPhases();
  const touched=updateRows(docs,true,result,releaseSha,shaByUrl);
  save(receiptPath,JSON.stringify(completed,null,2)+'\n');
  git('add',...touched,receiptPath);
  git('commit','-m','seo: confirm nine rewritten after verified Pages deploy [skip ci]');
  try{git('push','origin','HEAD:refs/heads/main');finalMain=true;}
  catch(error){if(attempt===3)throw error;say('Main metadata moved, retry',attempt);}
}
for(let attempt=1;attempt<=3;attempt++){
  checkoutRemote('seo-geo/staging','seo-nine-final-writer');
  const docs=readPhases();
  const touched=updateRows(docs,true,result,releaseSha,shaByUrl);
  git('add',...touched);
  if(!git('diff','--cached','--name-only'))break;
  git('commit','-m','seo: mirror nine confirmed rewritten statuses [skip ci]');
  try{git('push','origin','HEAD:refs/heads/seo-geo/staging');break;}
  catch(error){if(attempt===3)throw error;say('Staging metadata moved, retry',attempt);}
}
say('SUCCESS: nine approved articles, one Pages run, canonical GitHub registries finalized',result.html_url);
