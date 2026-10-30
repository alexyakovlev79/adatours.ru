import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateWordAlignment} from '../../src/lib/i18n/word-alignment.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex'),ru='RU source text';
const paths=[{path:'/title',field:'title',blockId:'tour:title:a'},
 {path:'/itinerary/0/title',field:'itinerary.title',blockId:'tour:itinerary_title:a'},
 {path:'/itinerary/0/text',field:'itinerary.text',blockId:'tour:itinerary_text:a'},
 {path:'/notes/0',field:'note',blockId:'tour:note:a'}];
const map={schemaVersion:1,entityId:'tour_test',entityType:'tour',matchingJobId:'match:tour_test',
 sourceContentPath:'src/content/tours/test.md',ruBlobSha256:sha(ru),paths};
const match={entityId:'tour_test',outcome:'selected_2027',sourceFingerprint:'fingerprint',
 selectedSource:{driveFileId:'file1',sourceSha256:sha('word'),sourceYearFolder:2027,modifiedTime:'2026-10-20T10:00:00Z'}};
function packet(){
 return {schemaVersion:1,kind:'tour_word_alignment',state:'pilot_prepared',releaseEligible:false,
 entityId:'tour_test',matchingJobId:'match:tour_test',matchingFingerprint:'fingerprint',
 ruContentPath:map.sourceContentPath,ruGitBlobSha:'blob1',
 word:{driveFileId:'file1',documentSha256:sha('word'),editionYear:2027,
 modifiedTime:'2026-10-20T10:00:00Z',rawDocxVerified:true,
 sourceRefConvention:'ooxml-paragraph-index-v1'},
 blocks:[
 {...paths[0],mode:'word_span',paragraphs:[{ref:'word/document.xml#p0002',textSha256:sha('title')}]},
 {...paths[1],mode:'ai_gap',reason:'No standalone corresponding title was present'},
 {...paths[2],mode:'word_span',paragraphs:[{ref:'word/document.xml#p0066',textSha256:sha('text')}]}
 ],coverage:{totalBlocks:4,mapped:3,wordSpans:2,aiGaps:1,remaining:1}};
}
const verify=(p,m=map,mc=match,txt=ru)=>validateWordAlignment(p,{map:m,match:mc,ruText:txt,ruBlobSha:'blob1'});
test('grounded partial Word alignment is not a published overlay',()=>{
 const r=verify(packet());assert.equal(r.itineraryDays,1);assert.equal(r.releaseEligible,false);
});
test('RU source change fails closed',()=>assert.throws(()=>verify(packet(),map,match,'new'),/RU content fingerprint/));
test('Word selection change fails closed',()=>{
 const p=packet();p.word.documentSha256=sha('other');assert.throws(()=>verify(p),/Word source evidence/);
});
test('missing text coverage is not accepted',()=>{
 const p=packet();p.blocks.splice(2,1);p.coverage={totalBlocks:4,mapped:2,wordSpans:1,aiGaps:1,remaining:2};
 assert.throws(()=>verify(p),/itinerary text missing/);
});
test('stable block ID change is rejected',()=>{
 const p=packet();p.blocks[0].blockId='tour:title:other';assert.throws(()=>verify(p),/re-owned block/);
});
test('duplicate source paragraph in two days fails',()=>{
 const p=packet();const second={path:'/itinerary/1/text',field:'itinerary.text',blockId:'tour:itinerary_text:b'};
 const m={...map,paths:[...paths,second]};
 p.blocks.push({...second,mode:'word_span',paragraphs:[{ref:'word/document.xml#p0066',textSha256:sha('other')}]});
 p.coverage={totalBlocks:5,mapped:4,wordSpans:3,aiGaps:1,remaining:1};
 assert.throws(()=>verify(p,m),/same Word paragraph/);
});
test('wrong matching status cannot create Word citation',()=>{
 assert.throws(()=>verify(packet(),map,{...match,outcome:'not_found_both'}),/stable Tour\/match identity/);
});
