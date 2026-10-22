import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import yaml from 'js-yaml';
import {makeSessionRequest} from '../scripts/lib/media-token-envelope.mjs';

const workflow=yaml.load(fs.readFileSync('.github/workflows/issue-media-upload-token.yml','utf8'));
const validation=workflow.jobs.issue.steps.find(step=>step.id==='request').run;
const program=validation.match(/<<'NODE'\n([\s\S]*?)\nNODE/)[1];

function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ada-session-test-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.mkdirSync(path.join(dir,'scripts/lib'),{recursive:true});
  fs.copyFileSync('scripts/lib/media-token-envelope.mjs',path.join(dir,'scripts/lib/media-token-envelope.mjs'));
  return dir;
}
function validate(dir,{raw,id='',eventName='workflow_dispatch',event}={}) {
  const runner=fs.mkdtempSync(path.join(dir,'runner-'));
  const eventFile=path.join(runner,'event.json'), output=path.join(runner,'outputs');
  fs.writeFileSync(eventFile,JSON.stringify(event||{}));
  const result=spawnSync(process.execPath,['--input-type=module'],{
    cwd:dir,input:program,encoding:'utf8',env:{...process.env,
      YC_SA_ID:'test-service-account',RUNNER_TEMP:runner,GITHUB_OUTPUT:output,
      GITHUB_EVENT_NAME:eventName,GITHUB_EVENT_PATH:eventFile,
      MEDIA_INPUT_REQUEST:raw||'',MEDIA_INPUT_REQUEST_ID:id},
  });
  return {...result,outputs:fs.existsSync(output)?fs.readFileSync(output,'utf8'):''};
}
function git(dir,...args) {
  return execFileSync('git',args,{cwd:dir,encoding:'utf8'}).trim();
}
function initGit(dir) {
  git(dir,'init','-q');
  git(dir,'config','user.email','session-test@example.invalid');
  git(dir,'config','user.name','Session test');
  git(dir,'add','.');git(dir,'commit','-qm','baseline');
  return git(dir,'rev-parse','HEAD');
}
function commitRequest(dir,file,request) {
  fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});
  fs.writeFileSync(path.join(dir,file),JSON.stringify(request));
  git(dir,'add',file);git(dir,'commit','-qm','public session request');
  return git(dir,'rev-parse','HEAD');
}

test('workflow isolates runners and uses trusted main code with data-only inputs',()=>{
  assert.equal(workflow.jobs.issue.steps[0].with.ref,'main');
  assert.equal(workflow.jobs.issue.steps[0].with['persist-credentials'],false);
  assert.match(workflow.jobs.issue.if,/github.ref == 'refs\/heads\/main'/);
  assert.match(workflow.concurrency.group,/github.run_id/);
  assert.ok(workflow.on.push.paths.includes('data/media/upload-session-requests/*.json'));
  assert.ok(!validation.includes('${{'));
});

test('twenty independent dispatch requests preserve their own request identity',t=>{
  const dir=fixture(t), seen=new Set();
  for(let i=0;i<20;i++) {
    const {request}=makeSessionRequest();
    const result=validate(dir,{raw:JSON.stringify(request),id:request.requestId});
    assert.equal(result.status,0,result.stderr);
    assert.match(result.outputs,new RegExp('request_id='+request.requestId));
    seen.add(result.outputs.match(/request_file=(.+)/)[1]);
  }
  assert.equal(seen.size,20);
});

test('dispatch rejects mismatched IDs, secrets, extra code/ref fields, invalid keys and expired requests',t=>{
  const dir=fixture(t), {request}=makeSessionRequest();
  const invalid=[
    {raw:JSON.stringify(request),id:'f'.repeat(32)===request.requestId?'e'.repeat(32):'f'.repeat(32)},
    {raw:JSON.stringify(request)},
    {raw:JSON.stringify({...request,privatePem:'PRIVATE KEY'}),id:request.requestId},
    {raw:JSON.stringify({...request,ref:'feature/untrusted'}),id:request.requestId},
    {raw:JSON.stringify({...request,token:'credential'}),id:request.requestId},
    {raw:JSON.stringify({...request,recipientPublicKey:'eA=='}),id:request.requestId},
    {raw:JSON.stringify({...request,createdAt:new Date(Date.now()-21*60000).toISOString()}),id:request.requestId},
  ];
  for(const input of invalid) {
    const result=validate(dir,input);
    assert.notEqual(result.status,0);
    assert.equal(result.outputs,'');
  }
});

test('mailbox reads request at triggering commit even after main advances',t=>{
  const dir=fixture(t), before=initGit(dir), {request}=makeSessionRequest();
  const file='data/media/upload-session-requests/'+request.requestId+'.json';
  const after=commitRequest(dir,file,request);
  const later=makeSessionRequest().request;
  commitRequest(dir,'data/media/upload-session-request.json',later);
  const result=validate(dir,{eventName:'push',event:{before,after,ref:'refs/heads/main'}});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.outputs,new RegExp('request_id='+request.requestId));
  assert.ok(!result.outputs.includes(later.requestId));
});

test('mailbox rejects changed files, mismatched filename, and multiple requests in one push',t=>{
  const dir=fixture(t), before=initGit(dir), {request}=makeSessionRequest();
  const file='data/media/upload-session-requests/'+request.requestId+'.json';
  const first=commitRequest(dir,file,request);
  const next={...request,createdAt:new Date(Date.now()+1000).toISOString()};
  const changed=commitRequest(dir,file,next);
  assert.notEqual(validate(dir,{eventName:'push',event:{before:first,after:changed,ref:'refs/heads/main'}}).status,0);
  const other=makeSessionRequest().request;
  const last=commitRequest(dir,'data/media/upload-session-requests/'+other.requestId+'.json',other);
  assert.notEqual(validate(dir,{eventName:'push',event:{before,after:last,ref:'refs/heads/main'}}).status,0);
  const wrong='0'.repeat(32)===other.requestId?'1'.repeat(32):'0'.repeat(32);
  const mismatch=commitRequest(dir,'data/media/upload-session-requests/'+wrong+'.json',other);
  assert.notEqual(validate(dir,{eventName:'push',event:{before:last,after:mismatch,ref:'refs/heads/main'}}).status,0);
});

test('legacy singleton push and manual dispatch remain available',t=>{
  const dir=fixture(t), before=initGit(dir), {request}=makeSessionRequest();
  const after=commitRequest(dir,'data/media/upload-session-request.json',request);
  for(const input of [{eventName:'push',event:{before,after,ref:'refs/heads/main'}},{}]) {
    const result=validate(dir,input);
    assert.equal(result.status,0,result.stderr);
    assert.match(result.outputs,new RegExp('request_id='+request.requestId));
  }
});
