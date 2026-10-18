#!/usr/bin/env node
/** All-ready SEO voice-rewrite publisher. Runs only in GitHub Actions. */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {validateVoiceRewrite,PHASE_FILES,REWRITE_ROOT,articlePath} from '../src/lib/seo-geo-voice-rewrite.mjs';

const root=REWRITE_ROOT+'/';
const main='refs/remotes/origin/main';
const staging=process.env.REWRITE_STAGING_SHA || '';
const control=process.env.REWRITE_DISPATCH_SHA || '';
const pathRelease=root+'pending-release.json';
const sh=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:12*1024*1024}).trimEnd();
const json=(x)=>JSON.stringify(x,null,2)+'\n';
const log=(...v)=>console.log('SEO rewrite publisher:',...v);
function show(ref,path){return execFileSync('git',['show',ref+':'+path],{encoding:'utf8',maxBuffer:15*1024*1024});}
function blob(ref,path){try{return sh('rev-parse',ref+':'+path);}catch{return null;}}
function write(path,txt){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,txt);}
function getJson(ref,path){return JSON.parse(show(ref,path));}
if(!staging || !control)throw Error('Pinned staging/dispatch SHA required');
sh('fetch','--no-tags','origin','main','seo-geo/voice-rewrite-staging','seo-geo/voice-rewrite-control');
const request=getJson(control,root+'dispatch.json');
if(request.mode!=='publish-all-ready'||request.stagingHead!==staging)throw Error('Mismatched pinned dispatch');
const prepared=getJson(staging,root+'prepared.json').entries||{};
const ready=Object.entries(prepared).filter(([,row])=>row.status==='ready').sort((a,b)=>a[1].order-b[1].order);
if(!ready.length){log('Nothing prepared at pinned staging SHA');process.exit(0);}
for(let attempt=1;attempt<=3;attempt++){
  sh('fetch','--no-tags','origin','main');
  sh('checkout','-B','voice-rewrite-main',main);
  const previous=JSON.parse(readFileSync(pathRelease,'utf8'));
  if(previous.status==='deploying'){
    log('Unfinished release',previous.batchId,'exists. Do not publish twice.');
    process.exit(0);
  }
  if(previous.status==='failed'){
    const failures=(previous.applied||[]).filter(item=>blob('HEAD',item.path)!==item.finalBlobSha);
    if(failures.length)throw Error('Previous failed deployment changed articles. Manual recovery required.');
    log('Retry existing content deployment',previous.batchId);
    if(process.env.GITHUB_OUTPUT)writeFileSync(process.env.GITHUB_OUTPUT,'deploy_needed=true\n',{flag:'a'});
    process.exit(0);
  }
  const byUrl=new Map();
  for(const name of PHASE_FILES){
    const phase=JSON.parse(readFileSync('data/seo-geo/registry/'+name,'utf8'));
    for(const entry of phase.entries)byUrl.set(entry.url,entry);
  }
  const accepted=[],held=[];
  for(const [url,row] of ready){
    const current=byUrl.get(url);
    const path=articlePath(url);
    let why='';
    if(!current||current.work!=='published') why='URL not currently published';
    else if(['archived','temporarily_unavailable','missing'].includes(current.availability))why='Unavailable URL';
    else if(row.path!==path)why='Article path mismatch';
    else if(blob('HEAD',path)!==row.sourceBlobSha)why='Main source changed after writer prepared';
    if(why){held.push({url,reason:why});continue;}
    try{
      const source=show('HEAD',path);
      const result=row.changed?show(staging,path):source;
      const diff=validateVoiceRewrite(source,result,url);
      if(diff.changed!==row.changed)throw Error('Ready record does not match content');
      accepted.push({url,path,sourceBlobSha:row.sourceBlobSha,content:result,
        changed:row.changed,changedLines:diff.changedLines,batchId:row.batchId});
    }catch(e){held.push({url,reason:String(e).slice(0,320)});}
  }
  if(!accepted.length){
    log('No safe articles to publish;',held.length,'held');
    console.log(JSON.stringify({status:'held',held}));
    process.exit(0);
  }
  for(const item of accepted)if(item.changed)write(item.path,item.content);
  sh('add',...accepted.filter(item=>item.changed).map(item=>item.path));
  const receipt={
    version:1,batchId:request.requestId,requestedAt:request.requestedAt,
    stagingHead:staging,sourceMainHead:sh('rev-parse','HEAD'),
    status:'deploying',createdAt:new Date().toISOString(),
    applied:accepted.map(item=>({url:item.url,path:item.path,
      sourceBlobSha:item.sourceBlobSha,finalBlobSha:item.changed?
      sh('hash-object',item.path):item.sourceBlobSha,
      changed:item.changed,changedLines:item.changedLines,batchId:item.batchId})),
    held,
  };
  write(pathRelease,json(receipt));
  sh('add',pathRelease);
  sh('config','user.name','github-actions[bot]');
  sh('config','user.email','41898282+github-actions[bot]@users.noreply.github.com');
  sh('commit','-m','seo rewrite: publish '+accepted.length+' voice-only articles ['+request.requestId+']');
  try{
    sh('push','origin','HEAD:refs/heads/main');
    const commit=sh('rev-parse','HEAD');
    log('Published content commit',commit,'articles',accepted.length,'held',held.length);
    console.log(JSON.stringify({status:'deployed_requested',commit,
      accepted:accepted.map(a=>a.url),held}));
    if(process.env.GITHUB_OUTPUT)writeFileSync(process.env.GITHUB_OUTPUT,
      'deploy_needed=true\nrelease_sha='+commit+'\n',{flag:'a'});
    process.exit(0);
  }catch(e){
    log('Concurrent main write; rebuild atop latest main',attempt);
    if(attempt===3)throw e;
  }
}
