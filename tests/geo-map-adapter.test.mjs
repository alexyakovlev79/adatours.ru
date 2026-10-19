import test from 'node:test';
import assert from 'node:assert/strict';
import {renderYandexMap} from '../src/scripts/geo-map-yandex.mjs';

const sample = {
  points: [
    {id:'rio',name:'Рио-де-Жанейро',position:1,coordinates:[-43.2,-22.9]},
    {id:'iguacu',name:'Фоз-ду-Игуасу',position:2,coordinates:[-54.5,-25.5]},
  ],
  route:[[-43.2,-22.9],[-54.5,-25.5]],
  bounds:{west:-54.5,east:-43.2,south:-25.5,north:-22.9},
  center:[-43.2,-22.9],zoom:6,
};

test('Yandex adapter creates vector map, route, markers and fits bounds', async () => {
  const previous = globalThis.window;
  let usedKey = false;
  class Map {
    constructor(root, props) {this.root=root;this.props=props;this.children=[];}
    addChild(child) {this.children.push(child);}
  }
  class Layer {constructor(props={}){this.props=props;}}
  class Feature {constructor(props){this.props=props;}}
  class Marker {constructor(props, element){this.props=props;this.element=element;}}
  globalThis.window = {ymaps3:{
    ready:Promise.resolve(),
    YMap:Map,YMapDefaultSchemeLayer:Layer,YMapDefaultFeaturesLayer:Layer,
    YMapFeature:Feature,YMapMarker:Marker,
  }};
  try {
    const canvas = {};
    const map = await renderYandexMap(
      canvas,sample,'TEST_BROWSER_KEY',() => {},
      async (id,url) => {assert.equal(id,'yandex-maps-v3');usedKey=url.includes('TEST_BROWSER_KEY');},
      point => ({id:point.id}),
    );
    assert.equal(usedKey,true);
    assert.equal(map.root,canvas);
    assert.equal(map.props.theme,'light');
    assert.deepEqual(map.props.location.bounds,[[-54.5,-25.5],[-43.2,-22.9]]);
    assert.equal(map.children.length,5);
    assert.equal(map.children[2].props.geometry.type,'LineString');
    assert.deepEqual(map.children[3].props.coordinates,[-43.2,-22.9]);
  } finally {
    globalThis.window=previous;
  }
});

test('Yandex adapter exposes script loading errors with a stable code', async () => {
  await assert.rejects(
    renderYandexMap({},sample,'TEST_BROWSER_KEY',() => {},
      async () => {throw new Error('Blocked network request');},() => ({})),
    err => err.mapCode === 'YANDEX_SCRIPT' &&
      err.message.includes('Blocked network request') &&
      !err.message.includes('TEST_BROWSER_KEY'),
  );
});

test('Yandex adapter reports initialization failure separately', async () => {
  const previous=globalThis.window;
  class BadMap {constructor(){throw new Error('Bad map constructor');}}
  class Layer {}
  globalThis.window={ymaps3:{
    ready:Promise.resolve(),YMap:BadMap,YMapDefaultSchemeLayer:Layer,
    YMapDefaultFeaturesLayer:Layer,YMapFeature:Layer,YMapMarker:Layer,
  }};
  try {
    await assert.rejects(
      renderYandexMap({},sample,'TEST_BROWSER_KEY',() => {},
        async () => {},() => ({})),
      err => err.mapCode === 'YANDEX_CREATE' &&
        err.message.includes('Bad map constructor'),
    );
  } finally {globalThis.window=previous;}
});
