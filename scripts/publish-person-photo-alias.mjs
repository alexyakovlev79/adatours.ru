import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parsePortraitRequest,chooseAliasAction} from '../src/lib/person-photo-alias.mjs';
const file=process.argv[2],credential=process.env.YC_IAM_TOKEN;
if(!file||!credential)throw Error('Trusted request and short-lived IAM token required');
const req=parsePortraitRequest(fs.readFileSync(file,'utf8'));
const team=JSON.parse(fs.readFileSync('src/data/organization/team.json','utf8'));
const person=team.members?.find(p=>p.id===req.personId);
if(!person||typeof person.photo?.src!=='string'||
  !person.photo.src.startsWith('/media/people/'+req.personId.slice(7)+'/'))
  throw Error('Not an existing portrait of this member');
const receipts=JSON.parse(fs.readFileSync('src/data/media/direct-s3-uploads.json','utf8'));
const record=receipts.assets?.find(r=>r.key===req.sourceKey);
if(!record||record.contentType!=='image/webp'||
  !/^[a-f0-9]{64}$/.test(record.sha256||'')||!Number.isInteger(record.bytes))
  throw Error('Immutable source not covered by S3 receipt');
const sha=x=>createHash('sha256').update(x).digest('hex');
const root='https://storage.yandexcloud.net/img.adatours.ru/';
const url=key=>root+key.split('/').map(encodeURIComponent).join('/');
async function get(key){
  const response=await fetch(url(key),{cache:'no-store',signal:AbortSignal.timeout(60000)});
  if([403,404].includes(response.status))return null;
  if(!response.ok)throw Error('S3 GET failed HTTP '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<1||bytes.length>15000000)throw Error('Bad object length');
  return {bytes,etag:response.headers.get('etag')};
}
const version=await get(req.sourceKey);
if(!version||sha(version.bytes)!==record.sha256||version.bytes.length!==record.bytes)
  throw Error('Immutable source S3 object does not match receipt SHA-256/length');
const previous=await get(req.aliasKey);
const oldHash=previous?sha(previous.bytes):null;
const action=chooseAliasAction(oldHash,record.sha256,req.expectedPreviousSha256);
if(action!=='already-matching'){
  if(action==='replace'&&!/^"[^"]+"$/.test(previous.etag||''))
    throw Error('Cannot perform conditional replacement without old ETag');
  const put=await fetch(url(req.aliasKey),{
    method:'PUT',headers:{
      Authorization:'Bearer '+credential,
      'Content-Type':'image/webp','Content-Length':String(version.bytes.length),
      'Cache-Control':'public, max-age=60, must-revalidate',
      'x-amz-meta-sha256':record.sha256,
      'x-amz-meta-original-key':req.sourceKey,
      ...(action==='create'?{'If-None-Match':'*'}:{'If-Match':previous.etag}),
    },body:version.bytes,signal:AbortSignal.timeout(60000),
  });
  if(!put.ok)throw Error('Conditional S3 PUT failed HTTP '+put.status);
}
const actual=await get(req.aliasKey);
if(!actual||sha(actual.bytes)!==record.sha256)throw Error('Alias readback SHA-256 mismatch');
const receipt={version:1,requestId:req.requestId,personId:req.personId,
  sourceKey:req.sourceKey,aliasKey:req.aliasKey,previousSha256:oldHash,
  currentSha256:record.sha256,action,verifiedAt:new Date().toISOString()};
fs.writeFileSync((process.env.RUNNER_TEMP||'/tmp')+'/portrait-alias-receipt.json',
  JSON.stringify(receipt,null,2)+'\n');
console.log('Portrait alias verified '+req.aliasKey+' SHA-256='+record.sha256);
