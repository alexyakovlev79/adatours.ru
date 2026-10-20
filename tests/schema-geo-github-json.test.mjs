import test from 'node:test';
import assert from 'node:assert/strict';
import {readGitHubJsonFile} from '../scripts/schema-geo-github-json.mjs';

const path='data/geo-knowledge/state.json';
const sha='a'.repeat(40);
const data={schemaVersion:2,publication:{status:'PUBLISHING',count:343}};
const encoded=Buffer.from(JSON.stringify(data)).toString('base64');

test('reads ordinary GitHub JSON from inline base64',async()=>{
 const urls=[];
 const result=await readGitHubJsonFile(async url=>{
  urls.push(url);
  return {encoding:'base64',content:encoded};
 },path,'main');
 assert.deepEqual(result,data);
 assert.deepEqual(urls,['/contents/'+path+'?ref=main']);
});

test('reads large GitHub JSON via the immutable blob SHA',async()=>{
 const urls=[];
 const result=await readGitHubJsonFile(async url=>{
  urls.push(url);
  if(url.startsWith('/contents/'))return {encoding:'none',content:'',sha};
  if(url==='/git/blobs/'+sha)return {encoding:'base64',content:encoded};
  throw Error('unexpected URL '+url);
 },path,'schema-geo/staging');
 assert.deepEqual(result,data);
 assert.deepEqual(urls,['/contents/'+path+'?ref=schema-geo%2Fstaging','/git/blobs/'+sha]);
});

test('rejects missing and malformed immutable blob identifiers',async()=>{
 await assert.rejects(readGitHubJsonFile(async()=>({encoding:'none',sha:'not-a-sha'}),path,'main'),/Missing immutable Git blob SHA/);
});

test('rejects blob response with no real contents',async()=>{
 await assert.rejects(readGitHubJsonFile(async url=>url.startsWith('/contents/')?{encoding:'none',sha}:{encoding:'none',content:''},path,'main'),/Git blob did not return base64/);
});
