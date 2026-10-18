#!/usr/bin/env node
/**
 * Finish SEO rewrite ONLY when a real Pages workflow_run contains the exact
 * released article blobs. Content deployment and metadata are separate.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {PHASE_FILES,REWRITE_ROOT} from '../src/lib/seo-geo-voice-rewrite.mjs';

const sh=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:14*1024*1024}).trimEnd();
const root=REWRITE_ROOT+'/';
const receiptPath=root+'pending-release.json';
const runSha=process.env.PAGES_RUN_SHA||'';
const runId=process.env.PAGES_RUN_ID||'';
const conclusion=process.env.PAGES_CONCLUSION||'';
const runUrl='https://github.com/alexyakovlev79/adatours.ru/actions/runs/'+runId;
const serialize=x=>JSON.stringify(x,null,2)+'\n';
const say=(...a)=>console.log('SEO rewrite finalize:',...a);
const blob=(ref,path)=>{try{return sh('rev-parse',ref+':'+path);}catch{return null;}};
function checkout(ref,local){sh('checkout','-B',local,ref);}
function config(){sh('config','user.name','github-actions[bot]');sh('config','user.email',
  '41898282+github-actions[bot]@users.noreply.github.com');}
if(!/^[a-f0-9]{40}$/.test(runSha)||!runId)throw Error('Pages SHA and run ID required');
sh('fetch','--no-tags','origin','main','seo-geo/voice-rewrite-staging');
config();
let finalized=[];
for(let attempt=0;attempt<3;attempt++){
  sh('fetch','--no-tags','origin','main');
  checkout('refs/remotes/origin/main','rewrite-finalize-main');
  const pending=JSON.parse(readFileSync(receiptPath,'utf8'));
  if(!['deploying','failed'].includes(pending.status)){
    say('No pending release to finalize; status',pending.status);
    process.exit(0);
  }
  const releaseSha=sh('log','-1','--format=%H','--',receiptPath);
  const ancestor=(()=>{try{sh('merge-base','--is-ancestor',releaseSha,runSha);return true;}catch{return false;}})();
  if(!ancestor){say('Deploy did not include pending release',releaseSha);process.exit(0);}
  const wrong=pending.applied.filter(row=>blob(runSha,row.path)!==row.finalBlobSha);
  if(wrong.length){say('Deploy has different article versions',wrong.length);process.exit(0);}
  if(conclusion!=='success'){
    if(pending.status==='failed'){say('Already marked failed');process.exit(0);}
    pending.status='failed';
    pending.failedAt=new Date().toISOString();
    pending.lastFailedRun=runUrl;
    writeFileSync(receiptPath,serialize(pending));
    sh('add',receiptPath);
    sh('commit','-m','seo rewrite: record failed deploy [skip ci]');
    try{sh('push','origin','HEAD:refs/heads/main');say('Recorded failed deployment',runUrl);process.exit(0);}
    catch(e){if(attempt===2)throw e;continue;}
  }
  const changes=new Map(),confirmed=[];
  for(const name of PHASE_FILES){
    const path='data/seo-geo/registry/'+name;
    const phase=JSON.parse(readFileSync(path,'utf8'));
    for(const row of phase.entries){
      const match=pending.applied.find(item=>item.url===row.url);
      if(!match||row.work==='rewritten')continue;
      if(row.work!=='published'||blob('HEAD',match.path)!==match.finalBlobSha)continue;
      row.work='rewritten';
      row.rewrittenAt=new Date().toISOString().slice(0,10);
      row.rewrittenCommit=releaseSha;
      row.rewriteDeployRun=runUrl;
      row.rewriteSourceBlobSha=match.sourceBlobSha;
      row.rewriteResultBlobSha=match.finalBlobSha;
      row.rewriteChanges=match.changedLines;
      confirmed.push(match);
      changes.set(path,phase);
    }
  }
  pending.status='completed';
  pending.deployedAt=new Date().toISOString();
  pending.deployedCommit=runSha;
  pending.deployRun=runUrl;
  pending.releaseCommit=releaseSha;
  pending.finalizedUrls=pending.applied.map(item=>item.url);
  for(const [path,phase] of changes)writeFileSync(path,serialize(phase));
  writeFileSync(receiptPath,serialize(pending));
  sh('add',receiptPath,...changes.keys());
  sh('commit','-m','seo rewrite: confirm '+pending.applied.length+' rewritten after Pages [skip ci]');
  try{
    sh('push','origin','HEAD:refs/heads/main');
    finalized=pending.applied;
    say('Confirmed',confirmed.length,'new rewritten statuses on successful Pages',runUrl);
    break;
  }catch(e){if(attempt===2)throw e;}
}
if(!finalized.length)process.exit(0);
// Mirror rewrite staging receipt (not original SEO staging). This permits
// later master invocations to skip already finalized URLs without rereading main.
for(let attempt=0;attempt<3;attempt++){
  sh('fetch','--no-tags','origin','seo-geo/voice-rewrite-staging');
  checkout('refs/remotes/origin/seo-geo/voice-rewrite-staging','rewrite-finalize-staging');
  const path=root+'prepared.json';
  const doc=JSON.parse(readFileSync(path,'utf8'));
  let updated=0;
  for(const row of finalized){
    const item=doc.entries?.[row.url];
    if(item&&item.status==='ready'&&item.batchId===row.batchId&&item.sourceBlobSha===row.sourceBlobSha){
      item.status='published';
      item.publishedAt=new Date().toISOString();
      item.deployRun=runUrl;
      updated++;
    }
  }
  if(!updated){say('Staging already synchronized or entries superseded');break;}
  writeFileSync(path,serialize(doc));
  sh('add',path);
  sh('commit','-m','seo rewrite: mark '+updated+' staged texts published [skip ci]');
  try{sh('push','origin','HEAD:refs/heads/seo-geo/voice-rewrite-staging');
    say('Staging synchronized',updated);break;}
  catch(e){if(attempt===2)throw e;}
}
