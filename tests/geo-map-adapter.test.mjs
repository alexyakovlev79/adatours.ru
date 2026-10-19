import test from 'node:test';
import assert from 'node:assert/strict';
import {renderYandexMap} from '../src/scripts/geo-map-yandex.mjs';
import {renderGoogleMap} from '../src/scripts/geo-map-google.mjs';
import {fitGeoCamera} from '../src/lib/geo-map-camera.mjs';

const sample = {
  points: [
    {id:'rio',name:'Рио-де-Жанейро',position:1,coordinates:[-43.205,-22.911]},
    {id:'iguacu',name:'Фоз-ду-Игуасу',position:2,coordinates:[-54.587,-25.540]},
    {id:'lima',name:'Лима',position:3,coordinates:[-77.038,-12.060]},
  ],
  route:[[-43.205,-22.911],[-54.587,-25.540],[-77.038,-12.060]],
  bounds:{west:-77.038,east:-43.205,south:-25.54,north:-12.06},
  center:[-43.205,-22.911],zoom:6,
};

test('Yandex uses the correct camera and pins without detached feature lines',async()=>{
  const previous=globalThis.window;
  class Map {
    constructor(root,props){this.root=root;this.props=props;this.children=[];}
    addChild(child){this.children.push(child);}
  }
  class Layer {constructor(props={}){this.props=props;}}
  class Feature {constructor(props){this.props=props;}}
  class Marker {constructor(props,element){this.props=props;this.element=element;}}
  class Listener {constructor(props){this.props=props;}}
  globalThis.window={ymaps3:{
    ready:Promise.resolve(),YMap:Map,YMapDefaultSchemeLayer:Layer,
    YMapDefaultFeaturesLayer:Layer,YMapFeature:Feature,YMapMarker:Marker,YMapListener:Listener,
  }};
  try {
    const canvas={clientWidth:1030,clientHeight:480};
    const map=await renderYandexMap(canvas,sample,'TEST_BROWSER_KEY',
      ()=>{},async()=>{},p=>({kind:'pin',id:p.id}),'ru',angle=>({kind:'arrow',angle}));
    assert.deepEqual(map.props.location.center.length,2);
    assert.ok(map.props.location.zoom<sample.zoom);
    assert.equal(map.props.location.zoom,
      fitGeoCamera(sample.route,{width:1030,height:480,pointZoom:sample.zoom}).zoom);
    assert.ok(!('bounds' in map.props.location));
    assert.equal(map.props.zoomRounding,'smooth');
    assert.equal(map.children.filter(x=>x instanceof Layer).length,2);
    assert.equal(map.children.filter(x=>x instanceof Feature).length,0);
    assert.equal(map.children.filter(x=>x instanceof Marker && x.element.kind==='pin').length,3);
    assert.equal(map.children.filter(x=>x instanceof Marker && x.element.kind==='arrow').length,0);
    assert.ok(map.children.filter(x=>x instanceof Marker && x.element.kind==='pin').every(x=>x.props.zIndex===100));
  } finally {globalThis.window=previous;}
});

test('Yandex one-place map has no route or arrows',async()=>{
  const previous=globalThis.window;
  class Map {constructor(root,props){this.props=props;this.children=[];}addChild(x){this.children.push(x);}}
  class Layer {constructor(props={}){this.props=props;}}
  class Feature {constructor(props){this.props=props;}}
  class Marker {constructor(props,element){this.props=props;this.element=element;}}
  class Listener {constructor(props){this.props=props;}}
  globalThis.window={ymaps3:{
    ready:Promise.resolve(),YMap:Map,YMapDefaultSchemeLayer:Layer,
    YMapDefaultFeaturesLayer:Layer,YMapFeature:Feature,YMapMarker:Marker,YMapListener:Listener,
  }};
  try{
    const data={...sample,points:[sample.points[0]],route:[sample.route[0]]};
    const map=await renderYandexMap({clientWidth:390,clientHeight:445},data,'TEST',
      ()=>{},async()=>{},()=>({kind:'pin'}),'ru',()=>({kind:'arrow'}));
    assert.equal(map.props.location.zoom,sample.zoom);
    assert.equal(map.children.filter(x=>x instanceof Feature).length,0);
    assert.equal(map.children.filter(x=>x instanceof Marker).length,1);
  }finally {globalThis.window=previous;}
});

test('Yandex provider still categorizes network and initialization failures',async()=>{
  await assert.rejects(
    renderYandexMap({},sample,'TEST_KEY',()=>{},
      async()=>{throw Error('Blocked network request');},()=>({})),
    e=>e.mapCode==='YANDEX_SCRIPT' && !e.message.includes('TEST_KEY'),
  );
  const previous=globalThis.window;
  class BadMap{constructor(){throw Error('Bad map constructor');}}
  class Layer{}
  globalThis.window={ymaps3:{
    ready:Promise.resolve(),YMap:BadMap,YMapDefaultSchemeLayer:Layer,
    YMapDefaultFeaturesLayer:Layer,YMapFeature:Layer,YMapMarker:Layer,YMapListener:Layer,
  }};
  try {
    await assert.rejects(renderYandexMap({},sample,'TEST_KEY',()=>{},
      async()=>{},()=>({})),e=>e.mapCode==='YANDEX_CREATE');
  }finally{globalThis.window=previous;}
});

test('Google uses the same custom camera and directions instead of provider fitBounds',async()=>{
  const previous=globalThis.window;
  let mapInstance;const created={polylines:[],markers:[]};
  class Map {
    constructor(canvas,props){this.props=props;mapInstance=this;}
    fitBounds(){throw Error('Google fitBounds must not be called');}
  }
  class Polyline{constructor(props){created.polylines.push(props);}}
  class Marker{
    constructor(props){created.markers.push(props);}
    addListener(){}
  }
  globalThis.window={google:{maps:{
    importLibrary:async name => name==='maps'?{Map}:{AdvancedMarkerElement:null},
    Polyline,Marker,SymbolPath:{CIRCLE:0},
  }}};
  try{
    await renderGoogleMap({clientWidth:1030,clientHeight:480},sample,'TEST_KEY','',
      ()=>{},async()=>{},()=>({kind:'pin'}),'en');
    assert.ok(mapInstance.props.zoom<sample.zoom);
    assert.equal(mapInstance.props.isFractionalZoomEnabled,true);
    assert.equal(mapInstance.props.zoom,
      fitGeoCamera(sample.route,{width:1030,height:480,pointZoom:sample.zoom}).zoom);
    assert.equal(created.polylines.length,sample.route.length-1);
    assert.ok(created.polylines.every(x=>x.path.length===2));
    assert.ok(created.polylines.every(x=>x.strokeColor!=='#FFFCF8' && x.strokeWeight<=3));
    assert.ok(created.markers.length>sample.points.length);
  }finally {globalThis.window=previous;}
});


// An overlapping featured destination must stay above all its recommendations.
test('Yandex and Google raise the featured point and color secondary markers',async()=>{
  const points=[
    {...sample.points[0],isPrimary:true},
    {...sample.points[1],isRelated:true},
    {...sample.points[2],isRelated:true},
  ];
  const data={...sample,points,route:[]};
  const previous=globalThis.window;
  const classes=[];
  class YMap {
    constructor(_root,props){this.props=props;this.children=[];}
    addChild(c){this.children.push(c);}
  }
  class Layer{constructor(props={}){this.props=props;}}
  class Marker{constructor(props,element){this.props=props;this.element=element;}}
  class Listener{constructor(props){this.props=props;}}
  globalThis.window={ymaps3:{
    ready:Promise.resolve(),YMap,YMapDefaultSchemeLayer:Layer,
    YMapDefaultFeaturesLayer:Layer,YMapMarker:Marker,YMapListener:Listener,
  }};
  try{
    const map=await renderYandexMap({clientWidth:450,clientHeight:445},data,'KEY',
      ()=>{},async()=>{},p=>({id:p.id}));
    const markers=map.children.filter(x=>x instanceof Marker);
    assert.equal(markers.length,3);
    assert.equal(markers.at(-1).element.id,'rio');
    assert.equal(markers.at(-1).props.zIndex,1000);
    assert.ok(markers.slice(0,2).every(m=>m.props.zIndex===100));
    assert.equal(map.children.filter(x=>x instanceof Listener).length,0);
  }finally{globalThis.window=previous;}
  const created=[];
  class GMap{constructor(){}}
  class GMarker{constructor(props){created.push(props);}addListener(){}}
  globalThis.window={google:{maps:{
    importLibrary:async()=>({Map:GMap,AdvancedMarkerElement:null}),
    Marker:GMarker,SymbolPath:{CIRCLE:0},
  }}};
  try{
    await renderGoogleMap({clientWidth:450,clientHeight:445},data,'KEY','',
      ()=>{},async()=>{},()=>({}),'en');
    assert.equal(created.length,3);
    assert.equal(created.at(-1).title,'Рио-де-Жанейро');
    assert.equal(created.at(-1).zIndex,1000);
    assert.ok(created.slice(0,2).every(m=>m.zIndex===100 && m.icon.fillColor==='#B8D5E2'));
    assert.equal(created.at(-1).icon.fillColor,'#F2CC67');
  }finally{globalThis.window=previous;}
});
