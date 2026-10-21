/* Ada Tours: deterministic SEO-interest swarm transitions. No network, filesystem or clocks inside core. */
export const SWARM_ROOT = 'data/migrations/interest-split-20261020/swarm';
export const shardPath = lane => SWARM_ROOT + '/shards/' + String(lane).padStart(2, '0') + '.json';
export function validOwner(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{10,100}$/.test(value); }
export function checkIdentity(ownerId, token) {
  if (!validOwner(ownerId) || !validOwner(token)) throw Error('Worker ownerId and token must be separate persistent 10-100 character strings.');
}
export function hashString(value) {
  let h = 2166136261;
  for (let i=0; i<value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const utc = ms => new Date(ms).toISOString();
export function available(item, nowMs) {
  return item.status === 'queued' || (item.status === 'leased' && Date.parse(item.leaseUntil) <= nowMs);
}
export function activeLease(item, nowMs) {
  return item.status === 'leased' && Date.parse(item.leaseUntil) > nowMs;
}
export function take(state, {ownerId, token, limit=3, nowMs, leaseMinutes=90}) {
  checkIdentity(ownerId, token);
  if (!Number.isFinite(nowMs) || !Number.isInteger(limit) || limit<1 || limit>4) throw Error('Invalid claim parameters');
  if (!Array.isArray(state.items)) throw Error('Invalid swarm shard');
  const owned = state.items.filter(x => activeLease(x,nowMs) && x.ownerId===ownerId && x.token===token);
  if (owned.length) return {changed:false, resumed:true, selected:owned};
  const selected=state.items.filter(x=>available(x,nowMs)).slice(0,limit);
  if (!selected.length) return {changed:false,resumed:false,selected:[]};
  const until=utc(nowMs+leaseMinutes*60000), since=utc(nowMs);
  for (const x of selected) {
    x.status='leased'; x.ownerId=ownerId; x.token=token; x.claimedAt=since;
    x.leaseUntil=until; x.attempts=(x.attempts||0)+1;
  }
  return {changed:true,resumed:false,selected};
}
export function refresh(state,{ownerId,token,ids,nowMs,leaseMinutes=90}) {
  checkIdentity(ownerId,token);
  if (!Array.isArray(ids)||!ids.length||ids.length>4||new Set(ids).size!==ids.length) throw Error('Specify 1-4 unique claimed IDs');
  const rows=ids.map(id=>state.items.find(x=>x.id===id));
  if (rows.some(x=>!x||!activeLease(x,nowMs)||x.ownerId!==ownerId||x.token!==token)) throw Error('Lease lost or expired; do not overwrite another worker');
  for(const x of rows) x.leaseUntil=utc(nowMs+leaseMinutes*60000);
  return rows;
}
export function release(state,{ownerId,token,ids,nowMs}) {
  checkIdentity(ownerId,token);
  if (!Array.isArray(ids)||!ids.length||ids.length>4||new Set(ids).size!==ids.length) throw Error('Specify 1-4 unique claimed IDs');
  const rows=ids.map(id=>state.items.find(x=>x.id===id));
  if (rows.some(x=>!x||!activeLease(x,nowMs)||x.ownerId!==ownerId||x.token!==token)) throw Error('Lease lost or expired; cannot release another worker');
  for(const x of rows) {x.status='queued';x.ownerId=null;x.token=null;x.leaseUntil=null;x.claimedAt=null;}
  return rows;
}
export function validateSubmitArgs({ownerId,token,items}) {
  checkIdentity(ownerId,token);
  if(!Array.isArray(items)||!items.length||items.length>4) throw Error('Submit 1-4 records per checkpoint');
  if(new Set(items.map(x=>x.id)).size!==items.length) throw Error('Duplicate task ID in submission');
  for(const x of items) {
    if(!/^seo-\d{4}$/.test(x.id||'')) throw Error('Invalid task ID');
    if(!['edited','confirmed','review'].includes(x.decision)) throw Error('Decision must be edited, confirmed, or review');
    if(typeof x.note!=='string'||x.note.trim().length<28||x.note.length>2400) throw Error('Each result needs a specific 28-2400 character semantic explanation');
    if(x.decision==='review'){
      if(x.edits?.length)throw Error('Review blockers cannot change published articles');
    } else {
      if(!/^[a-f0-9]{40}$/.test(x.expectedSha||''))throw Error('Expected article blob SHA required');
      if(!Array.isArray(x.edits)||x.edits.length>24)throw Error('Edits must be an array (max 24)');
      if(x.decision==='edited'&&!x.edits.length)throw Error('Edited requires a nonempty patch');
      if(x.decision==='confirmed'&&x.edits.length)throw Error('Confirmed means no change; use edited instead');
    }
  }
}
export function requireLease(state,{ownerId,token,ids,nowMs}) {
  checkIdentity(ownerId,token);
  const rows=ids.map(id=>state.items.find(x=>x.id===id));
  if(rows.some(x=>!x||!activeLease(x,nowMs)||x.ownerId!==ownerId||x.token!==token)) throw Error('Lease has expired or belongs to a different worker');
  return rows;
}
export function applyEdits(source,edits) {
  let output=source;
  for(const patch of edits) {
    if(typeof patch.find!=='string'||!patch.find.length||typeof patch.replace!=='string')throw Error('Patch find/replace must be text');
    if(patch.find===patch.replace)throw Error('No-op patch is not allowed');
    const at=output.indexOf(patch.find);
    if(at<0||output.indexOf(patch.find,at+patch.find.length)>=0) throw Error('Patch fragment must occur exactly once: '+patch.find.slice(0,100));
    output=output.slice(0,at)+patch.replace+output.slice(at+patch.find.length);
  }
  return output;
}
export function checkArticleInvariant(before,after,task) {
  const head = raw => raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || '';
  const field=(raw,k)=>head(raw).match(new RegExp('^'+k+':\\s*(.+)$','m'))?.[1]?.trim()||null;
  for(const key of ['targetPath','kind','status']) if(field(before,key)!==field(after,key)) throw Error('Forbidden article frontmatter change: '+key);
  if(field(before,'targetPath')!==task.url) throw Error('Article targetPath does not match reserved task URL');
  if(after.length<250||!head(after))throw Error('Article truncated or malformed');
  if(/\btheme_wildlife\b/.test(head(after)) && /\btheme_nature\b/.test(head(after)) && false)throw Error('unreachable');
}
export function finish(state,{ownerId,token,results,nowMs}) {
  const rows=requireLease(state,{ownerId,token,ids:results.map(x=>x.id),nowMs});
  for(let i=0;i<rows.length;i++){
    const x=rows[i],r=results[i];
    x.status=r.decision==='review'?'review':'done';
    x.decision=r.decision;x.note=r.note;x.sourceSha=r.sourceSha||null;x.resultSha=r.resultSha||null;
    x.completedAt=utc(nowMs);x.leaseUntil=null;x.checkedBy=ownerId;
  }
  return rows;
}
export function summarize(states) {
  const out={total:0,queued:0,leased:0,done:0,review:0};
  for(const state of states){for(const item of state.items){out.total++;if(!(item.status in out))throw Error('Unrecognized swarm status: '+item.status);out[item.status]++;}}
  return out;
}
