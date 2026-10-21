import test from 'node:test';
import assert from 'node:assert/strict';
import {take,refresh,release,requireLease,applyEdits,checkArticleInvariant,finish,summarize,validateSubmitArgs} from '../scripts/interest-split-swarm-core.mjs';
const owner='editor-agent-123456',token='lease-unique-123456',nextOwner='editor-agent-abcdef',nextToken='lease-unique-abcdef';
const first=()=>({schemaVersion:1,lane:0,items:[
 {id:'seo-0001',lane:0,url:'/interests/wildlife/',path:'data/seo-geo/articles/interests/wildlife/index.md',status:'queued',attempts:0},
 {id:'seo-0002',lane:0,url:'/interests/nature/',path:'data/seo-geo/articles/interests/nature/index.md',status:'queued',attempts:0}
]});
const t=Date.UTC(2026,9,21,9);
test('same owner/token resumes own lease and another cannot receive it',()=>{
 const s=first();
 const a=take(s,{ownerId:owner,token,limit:1,nowMs:t});
 assert.equal(a.selected[0].id,'seo-0001');
 const resumed=take(s,{ownerId:owner,token,limit:1,nowMs:t+1000});
 assert.equal(resumed.resumed,true);
 const b=take(s,{ownerId:nextOwner,token:nextToken,limit:1,nowMs:t});
 assert.equal(b.selected[0].id,'seo-0002');
});
test('expiry allows reclaim but rejects stale worker submission',()=>{
 const s=first();
 take(s,{ownerId:owner,token,limit:1,nowMs:t,leaseMinutes:1});
 take(s,{ownerId:nextOwner,token:nextToken,limit:1,nowMs:t+61000});
 assert.equal(s.items[0].ownerId,nextOwner);
 assert.throws(()=>requireLease(s,{ownerId:owner,token,ids:['seo-0001'],nowMs:t+62000}),/Lease/);
});
test('finish is atomic with submitted results and preserves immutable work trail',()=>{
 const s=first();
 take(s,{ownerId:owner,token,limit:2,nowMs:t});
 const item=finish(s,{ownerId:owner,token,nowMs:t+1000,results:[
 {id:'seo-0001',decision:'edited',note:'Fixed animal versus landscape link without altering metadata.',sourceSha:'a'.repeat(40),resultSha:'b'.repeat(40)}
 ]});
 assert.equal(item[0].status,'done');
 assert.equal(item[0].sourceSha,'a'.repeat(40));
 assert.deepEqual(summarize([s]),{total:2,queued:0,leased:1,done:1,review:0});
 assert.throws(()=>refresh(s,{ownerId:owner,token,ids:['seo-0001'],nowMs:t+1100}),/Lease/);
 const released=release(s,{ownerId:owner,token,ids:['seo-0002'],nowMs:t+1100});
 assert.equal(released[0].status,'queued');
});
test('unique literal edits and article identity guard',()=>{
 const input='---\ntargetPath: /interests/wildlife/\nkind: interest\nstatus: approved\n---\n\nUnique intro: nature and birds. '+('Sample article body about landscapes. '.repeat(12));
 const newText=applyEdits(input,[{find:'nature and birds',replace:'observing wild birds'}]);
 checkArticleInvariant(input,newText,{url:'/interests/wildlife/'});
 assert.ok(newText.includes('Unique intro: observing wild birds.'));
 assert.throws(()=>applyEdits(input,[{find:'article',replace:'guide'}]),/exactly once/);
 assert.throws(()=>checkArticleInvariant(input,newText.replace('targetPath: /interests/wildlife/','targetPath: /interests/nature/'),{url:'/interests/wildlife/'}),/Forbidden/);
});
test('submit requires explicit semantic evidence and source CAS sha',()=>{
 const base={ownerId:owner,token,items:[{id:'seo-0001',decision:'confirmed',expectedSha:'a'.repeat(40),edits:[],note:'Checked narrative: wildlife claims reflect real observing days.'}]};
 assert.doesNotThrow(()=>validateSubmitArgs(base));
 assert.throws(()=>validateSubmitArgs({...base,items:[{...base.items[0],note:'fine'}]}),/explanation/);
 assert.throws(()=>validateSubmitArgs({...base,items:[{...base.items[0],decision:'edited'}]}),/nonempty/);
});
