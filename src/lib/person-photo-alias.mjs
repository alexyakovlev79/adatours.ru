// Stable S3 URL for replacement of an existing team member photo.
const hash=/^[a-f0-9]{64}$/;
export function parsePortraitRequest(raw){
  const r=typeof raw==='string'?JSON.parse(raw):raw;
  const allowed=['expectedPreviousSha256','personId','requestId','sourceKey','version'];
  if(!r||Array.isArray(r)||Object.keys(r).sort().join('|')!==allowed.join('|'))
    throw Error('Unexpected request fields');
  if(r.version!==1||!(/^[a-f0-9]{32}$/.test(r.requestId))||
    !/^person_[a-z0-9_-]+$/.test(r.personId))throw Error('Invalid person or request');
  const stem=r.personId.slice(7),prefix='media/people/'+stem+'/';
  if(typeof r.sourceKey!=='string'||!r.sourceKey.startsWith(prefix)||
    !/^media\/people\/[a-z0-9_-]+\/[A-Za-z0-9_.-]*\d{8}[A-Za-z0-9_.-]*\.webp$/.test(r.sourceKey))
    throw Error('Source must be a dated immutable WebP belonging to this person');
  if(r.expectedPreviousSha256!==null&&!hash.test(r.expectedPreviousSha256||''))
    throw Error('Bad expected SHA-256');
  return {...r,aliasKey:prefix+'current.webp'};
}
export function chooseAliasAction(previous,newSha,expected){
  if(!hash.test(newSha||''))throw Error('Bad source SHA');
  if(previous===newSha)return 'already-matching';
  if(previous===null&&expected===null)return 'create';
  if(previous!==expected)throw Error('Stale previous alias SHA-256');
  return 'replace';
}
