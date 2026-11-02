import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
const SHA=/^[a-f0-9]{64}$/;
const REF=/^word\/(?:document|header\d+|footer\d+|footnotes|endnotes)\.xml#p\d{4}$/;
const fail=s=>{throw Error('Word block alignment: '+s);};
/** Only a verified source alignment. Never calls a translated block approved or published. */
export function validateWordAlignment(packet,{map,match,ruText,ruBlobSha}){
 if(!packet||packet.schemaVersion!==1||packet.kind!=='tour_word_alignment'||
 packet.state!=='pilot_prepared'||packet.releaseEligible!==false)fail('invalid release gate');
 if(!map||map.schemaVersion!==1||map.entityType!=='tour'||map.entityId!==packet.entityId||
 !match||match.entityId!==packet.entityId||!['selected_2027','selected_2026'].includes(match.outcome))
 fail('stable Tour/match identity');
 if(packet.matchingJobId!=='match:'+packet.entityId||map.matchingJobId!==packet.matchingJobId||
 packet.ruContentPath!==map.sourceContentPath||hash(ruText)!==map.ruBlobSha256||
 packet.ruGitBlobSha!==ruBlobSha)fail('RU content fingerprint changed');
 const src=match.selectedSource||{},year=match.outcome==='selected_2027'?2027:2026;
 if(!SHA.test(src.sourceSha256||'')||src.driveFileId!==packet.word.driveFileId||
 src.sourceSha256!==packet.word.documentSha256||Number(src.sourceYearFolder)!==year||
 src.modifiedTime!==packet.word.modifiedTime||packet.word.editionYear!==year||
 packet.matchingFingerprint!==match.sourceFingerprint||
 packet.word.rawDocxVerified!==true||packet.word.sourceRefConvention!=='ooxml-paragraph-index-v1')
 fail('Word source evidence does not match saved selection');
 if(!Array.isArray(map.paths)||!Array.isArray(packet.blocks)||!packet.blocks.length)fail('missing slots');
 const byPath=new Map(map.paths.map(x=>[x.path,x]));if(byPath.size!==map.paths.length)fail('duplicate map path');
 const assigned=new Set(),days=new Set();let wordSpans=0,aiGaps=0,paragraphRefs=0;
 for(const x of packet.blocks){
  const original=byPath.get(x.path);
  if(!original||assigned.has(x.path)||x.blockId!==original.blockId||x.field!==original.field)
  fail('unknown or re-owned block '+x.path);
  assigned.add(x.path);
  if(x.mode==='word_span'){
   if(!Array.isArray(x.paragraphs)||!x.paragraphs.length||x.reason!==undefined)fail('empty Word span');
   let prior=-1;
   for(const p of x.paragraphs){
    if(!REF.test(p.ref||'')||!SHA.test(p.textSha256||''))fail('invalid paragraph locator/hash');
    const i=Number(p.ref.match(/#p(\d{4})$/)[1]);
    if(i<=prior)fail('out of order Word span');
    prior=i;paragraphRefs++;
    if(x.field==='itinerary.text'){
     if(days.has(p.ref))fail('same Word paragraph assigned to several days');
     days.add(p.ref);
    }
   }
   wordSpans++;
  } else if(x.mode==='ai_gap'){
   if(typeof x.reason!=='string'||x.reason.length<16||x.paragraphs!==undefined)
    fail('unexplained AI gap');
   aiGaps++;
  } else fail('bad alignment mode');
 }
 const itinerary=map.paths.filter(x=>/^\/itinerary\/\d+\/text$/.test(x.path));
 if(itinerary.some(x=>packet.blocks.find(y=>y.path===x.path)?.mode!=='word_span'))
 fail('itinerary text missing Word evidence');
 const remaining=map.paths.length-assigned.size;
 if(packet.coverage.totalBlocks!==map.paths.length||
 packet.coverage.mapped!==packet.blocks.length||
 packet.coverage.wordSpans!==wordSpans||
 packet.coverage.aiGaps!==aiGaps||
 packet.coverage.remaining!==remaining||
 remaining<=0)fail('partial coverage receipt incorrect');
 return {id:packet.entityId,itineraryDays:itinerary.length,wordSpans,aiGaps,
 paragraphRefs,remaining,totalBlocks:map.paths.length,releaseEligible:false};
}
