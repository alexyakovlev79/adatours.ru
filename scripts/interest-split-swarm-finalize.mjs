/** Finalize a fully completed 16-shard nature/wildlife editorial swarm. Offline, never deploys. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SWARM_ROOT, shardPath, summarize } from './interest-split-swarm-core.mjs';
const readJson=path=>JSON.parse(readFileSync(path,'utf8'));
const digest=raw=>createHash('sha1').update('blob '+Buffer.byteLength(raw)+'\0').update(raw).digest('hex');
const manifest=readJson(SWARM_ROOT+'/manifest.json');
const shards=Array.from({length:manifest.shardCount},(_,i)=>readJson(shardPath(i)));
const totals=summarize(shards),all=shards.flatMap(shard=>shard.items);
const now=Date.now(),expired=all.filter(x=>x.status==='leased'&&Date.parse(x.leaseUntil)<=now);
console.log(JSON.stringify({branch:manifest.branch,baseline:manifest.baseSha,...totals,expiredLeases:expired.length,completionPct:Math.round(10000*totals.done/totals.total)/100},null,2));
const doFinalize=process.argv.includes('--finalize');
if(!doFinalize)process.exit(0);
if(totals.total!==manifest.taskCount||totals.queued||totals.leased||totals.review){
  console.error('Refusing cutover: all tasks must be done, none leased, queued or in REVIEW.');
  process.exit(1);
}
const ledgerPath='data/migrations/interest-split-20261020/editorial-decisions.json';
const ledger=readJson(ledgerPath),original=new Map(ledger.articles.map(x=>[x.articlePath,x]));
let added=0;
for(const item of all){
  if(item.status!=='done'||!['edited','confirmed'].includes(item.decision)||
    !/^[0-9a-f]{40}$/.test(item.sourceSha||'')||!/^[0-9a-f]{40}$/.test(item.resultSha||'')||
    !item.note||item.note.length<28)throw Error('Incomplete confirmation for '+item.id);
  const text=readFileSync(item.path,'utf8');
  if(digest(text)!==item.resultSha)throw Error('Blob SHA mismatch: '+item.id+' '+item.path);
  const target=text.match(/^targetPath:\s*(\S+)/m)?.[1];
  if(target!==item.url)throw Error('targetPath mismatch '+item.id);
  const previous=original.get(item.path);
  if(previous){
    if(previous.resultBlobSha!==item.resultSha)throw Error('Conflicting previous decision for '+item.path);
    continue;
  }
  const value={url:item.url,articlePath:item.path,sourceBlobSha:item.sourceSha,
    resultBlobSha:item.resultSha,decision:'reviewed_for_interest_split',
    evidence:item.note,worker:item.checkedBy,reviewedAt:item.completedAt,swarmTaskId:item.id};
  ledger.articles.push(value);original.set(item.path,value);added++;
}
if(!process.argv.includes('--write')) {
  console.log('DRY RUN: '+added+' decisions would be appended. Use --finalize --write once ready.');
  process.exit(0);
}
ledger.checkedAt=new Date().toISOString();
writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
manifest.status='closed';
manifest.closedAt=new Date().toISOString();
manifest.completion={count:totals.done,previousReviewed:manifest.initialReviewed,appendedDecisions:added};
writeFileSync(SWARM_ROOT+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('CHECKPOINT READY: '+totals.done+' swarm tasks, '+added+' new editorial decisions; no production deploy was performed.');
