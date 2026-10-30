import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { classifyChanges } from '../src/lib/deploy-change-scope.mjs';
const git=(a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:40*1024*1024});
const base=process.env.ADA_PUSH_BEFORE_SHA||'';
let result={mode:'full',reason:'Manual/scheduled event or unknown baseline'};
if(process.env.GITHUB_EVENT_NAME==='push'&&/^[a-f0-9]{40}$/.test(base)&&!/^0+$/.test(base)){
  try{
    try{git(['cat-file','-e',base+'^{commit}']);}
    catch{git(['fetch','--no-tags','--filter=blob:none','--depth=1','origin',base]);}
    const raw=git(['diff','--no-renames','--name-status','-z',base,'HEAD']);
    const rows=raw.split('\0').filter(Boolean), changed=[];
    if(rows.length%2)throw Error('Malformed Git diff');
    for(let i=0;i<rows.length;i+=2)changed.push({status:rows[i],path:rows[i+1]});
    result=classifyChanges(changed,p=>git(['show',base+':'+p]),p=>git(['show','HEAD:'+p]));
  }catch(e){result={mode:'full',reason:'Baseline or diff cannot be trusted: '+String(e.message||e).slice(0,90)};}
}
const command=result.mode==='fast'?'npm run build:fast':'npm run build';
console.log('Ada deploy QA: '+result.mode+'; '+result.reason);
if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,
  'build_cmd='+command+'\nmode='+result.mode+'\n');
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  'Build QA: **'+result.mode+'**; '+result.reason+'\n');
