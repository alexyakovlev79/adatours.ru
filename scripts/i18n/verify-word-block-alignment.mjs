#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateWordAlignment} from '../../src/lib/i18n/word-alignment.mjs';
const roots=process.argv.slice(2);
if(roots.length!==3)throw Error('Usage: verify-word-block-alignment.mjs feature matching current-main');
const [feature,matching,main]=roots.map(x=>path.resolve(x));
const get=(root,p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const ids=['tour_brazil_rio_four_days','tour_chile_easter_island_3_days_2027',
 'tour_colombia_essential_5_days'];
const results=[],issues=[];
for(const id of ids)try{
 const packet=get(feature,'data/i18n/word-block-alignments/pilot/'+id+'.json');
 const map=get(feature,'data/i18n/block-maps/tours/'+id+'.json');
 const resultPath='data/i18n/matching/v1/results/match--'+id+'/submission-match-'+id+'-1.json';
 const match=get(matching,resultPath).result;
 const ruText=fs.readFileSync(path.join(main,map.sourceContentPath),'utf8');
 const git=spawnSync('git',['hash-object',map.sourceContentPath],{cwd:main,encoding:'utf8'});
 if(git.status!==0)throw Error('git hash-object failed');
 const checked=validateWordAlignment(packet,{map,match,ruText,ruBlobSha:git.stdout.trim()});
 results.push(checked);
 console.log(JSON.stringify({status:'pilot_source_aligned',...checked}));
}catch(e){issues.push({id,reason:String(e)});}
console.log(JSON.stringify({status:issues.length?'failed':'pilot_passed',processed:results.length,
 totalWordSpans:results.reduce((a,b)=>a+b.wordSpans,0),
 totalAiGaps:results.reduce((a,b)=>a+b.aiGaps,0),
 remainingToAlign:results.reduce((a,b)=>a+b.remaining,0),issues}));
if(issues.length||results.length!==ids.length)process.exitCode=1;
