// Run on a fresh main checkout with the repository's normal npm dependencies.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import yaml from 'js-yaml';
const entities=[];
for(const family of ['countries','destinations','tours','excursions']){
 const catalog=JSON.parse(fs.readFileSync(`data/source-index/catalogs/${family}.json`,'utf8'));
 for(const r of catalog.entries){
  let data=null,sourceBlobSha=null;
  if(fs.existsSync(r.contentPath)){
   const raw=fs.readFileSync(r.contentPath,'utf8'),fm=raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
   if(!fm)throw Error('Missing frontmatter: '+r.contentPath);
   data=yaml.load(fm[1]);if(data.id!==r.id)throw Error('Stable ID mismatch: '+r.contentPath);
   sourceBlobSha=execFileSync('git',['hash-object',r.contentPath],{encoding:'utf8'}).trim();
  }
  entities.push({id:r.id,type:r.type,name:r.name,url:r.url,contentPath:r.contentPath,entryPath:r.entryPath,countryIds:r.countryIds||[],destinationIds:r.destinationIds||[],status:data?.status||r.status,sourceBlobSha});
 }
}
const snapshotCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
fs.writeFileSync('data/geo-knowledge/source-inventory.json',JSON.stringify({snapshotCommit,entities},null,2)+'\n');
console.log(JSON.stringify({snapshotCommit,entities:entities.length}));
