import {execFileSync} from 'node:child_process';

// Immutable source tree metadata for the one-time validated legacy S3 migration.
// No binary blobs downloaded. New S3 objects require separate direct-S3 receipts.
const cache=new Map();
export function frozenMediaKeys(repoRoot){
  let found=cache.get(repoRoot);
  if(found)return found;
  try{
    const lines=execFileSync('git',['ls-tree','-r','--name-only','HEAD','--','public/media/'],
      {cwd:repoRoot,encoding:'utf8',maxBuffer:2*1024*1024});
    found=new Set(lines.split('\n').filter(Boolean).map(p=>p.slice('public'.length)));
  }catch{
    found=new Set();
  }
  cache.set(repoRoot,found);
  return found;
}
export function migratedLegacyAssetExists(repoRoot,url){
  return typeof url==='string'&&url.startsWith('/media/')&&
    !url.includes('..')&&frozenMediaKeys(repoRoot).has(url);
}
