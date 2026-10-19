import test from 'node:test';
import assert from 'node:assert/strict';
import {canMountGeoMap, movedDown, nearViewport} from '../src/lib/geo-map-lazy.mjs';

test('map never starts on initial page load, even when already visible', () => {
  assert.equal(canMountGeoMap({firstScreenReady:true,scrolledDown:false,near:true}),false);
  assert.equal(canMountGeoMap({firstScreenReady:false,scrolledDown:true,near:true}),false);
  assert.equal(canMountGeoMap({firstScreenReady:true,scrolledDown:true,near:false}),false);
  assert.equal(canMountGeoMap({firstScreenReady:true,scrolledDown:true,near:true}),true);
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
