import test from 'node:test';
import assert from 'node:assert/strict';
import {canMountGeoMap, isMapVisible, movedDown, nearViewport} from '../src/lib/geo-map-lazy.mjs';

test('a visible map starts without scrolling as soon as first-screen assets are ready', () => {
  assert.equal(canMountGeoMap({firstScreenReady:true,scrolledDown:false,near:true,visible:true}),true);
  assert.equal(canMountGeoMap({firstScreenReady:false,scrolledDown:false,near:true,visible:true}),false);
  assert.equal(canMountGeoMap({firstScreenReady:true,scrolledDown:false,near:true,visible:false}),false);
  assert.equal(canMountGeoMap({firstScreenReady:true,scrolledDown:true,near:false,visible:false}),false);
  assert.equal(canMountGeoMap({firstScreenReady:true,scrolledDown:true,near:true,visible:false}),true);
});

test('strict viewport overlap counts even a small visible edge on reload or restore', () => {
  const box = (top,bottom,left=100,right=900) => ({top,bottom,left,right,width:right-left,height:bottom-top});
  assert.equal(isMapVisible(box(899,1200),1600,900),true);
  assert.equal(isMapVisible(box(-200,1),1600,900),true);
  assert.equal(isMapVisible(box(900,1200),1600,900),false);
  assert.equal(isMapVisible(box(-200,0),1600,900),false);
  assert.equal(isMapVisible(box(200,300,-120,1),1600,900),true);
  assert.equal(isMapVisible(box(200,300,-120,0),1600,900),false);
  assert.equal(isMapVisible(box(0,10,100,100),1600,900),false);
});

test('only an actual downward page movement opens the scroll gate', () => {
  assert.equal(movedDown(0,0),false);
  assert.equal(movedDown(0,1),false);
  assert.equal(movedDown(0,2),true);
  assert.equal(movedDown(180,100),false);
  assert.equal(movedDown(180,190),true);
  assert.equal(movedDown(NaN,200),false);
});

test('maps remain lazy until within 300px of viewport, regardless of initial position', () => {
  assert.equal(nearViewport({top:1400,bottom:1900},900),false);
  assert.equal(nearViewport({top:1199,bottom:1500},900),true);
  assert.equal(nearViewport({top:-500,bottom:-301},900),false);
  assert.equal(nearViewport({top:-500,bottom:-299},900),true);
});
