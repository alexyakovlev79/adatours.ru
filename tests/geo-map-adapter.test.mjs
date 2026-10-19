import test from 'node:test';
import assert from 'node:assert/strict';
import {renderYandexMap} from '../src/scripts/geo-map-yandex.mjs';
import {renderGoogleMap} from '../src/scripts/geo-map-google.mjs';
import {fitGeoCamera} from '../src/lib/geo-map-camera.mjs';
import {orderedGeoMapMarkers, MAP_MARKER_Z_INDEX} from '../src/lib/geo-map-marker-priority.mjs';

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
    const pins=map.children.filter(x=>x instanceof Marker && x.element.kind==='pin');
    assert.deepEqual(pins.map(x=>x.element.id),['iguacu','lima','rio']);
    assert.deepEqual(pins.map(x=>x.props.zIndex),[100,900,1000]);
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
    const pins=created.markers.filter(x=>x.title);
    assert.deepEqual(pins.map(x=>x.title),['Фоз-ду-Игуасу','Лима','Рио-де-Жанейро']);
    assert.deepEqual(pins.map(x=>x.zIndex),[100,900,1000]);
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
    assert.deepEqual(markers.map(m=>m.element.id),['lima','iguacu','rio']);
    assert.deepEqual(markers.map(m=>m.props.zIndex),[998,999,1000]);
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
    assert.deepEqual(created.map(m=>m.title),['Лима','Фоз-ду-Игуасу','Рио-де-Жанейро']);
    assert.deepEqual(created.map(m=>m.zIndex),[998,999,1000]);
    assert.ok(created.slice(0,2).every(m=>m.icon.fillColor==='#B8D5E2'));
    assert.equal(created.at(-1).icon.fillColor,'#F2CC67');
  }finally{globalThis.window=previous;}
});


test('excursion departure and last visited marker always overlay intermediate stops',()=>{
  const markers=orderedGeoMapMarkers(sample);
  assert.deepEqual(markers.map(x=>x.point.position),[2,3,1]);
  assert.deepEqual(markers.map(x=>x.zIndex),[
    MAP_MARKER_Z_INDEX.normal,MAP_MARKER_Z_INDEX.finish,MAP_MARKER_Z_INDEX.start,
  ]);
});

test('return visit gives actual last route stop second-highest priority',()=>{
  const data={...sample,route:[
    sample.points[0].coordinates, sample.points[2].coordinates,
    sample.points[1].coordinates,
  ]};
  const markers=orderedGeoMapMarkers(data);
  assert.deepEqual(markers.map(x=>x.point.id),['lima','iguacu','rio']);
  assert.deepEqual(markers.map(x=>x.zIndex),[100,900,1000]);
});

test('returning to departure leaves marker one on top, no conflicting finish',()=>{
  const data={...sample,route:[
    sample.points[0].coordinates,sample.points[1].coordinates,
    sample.points[0].coordinates,
  ]};
  const markers=orderedGeoMapMarkers(data);
  assert.equal(markers.at(-1).point.position,1);
  assert.equal(markers.at(-1).zIndex,1000);
  assert.ok(markers.slice(0,-1).every(x=>x.zIndex===100));
});

test('destination neighbors layer in descending recommendation order',()=>{
  const data={...sample,route:[],points:sample.points.map((p,i)=>({
    ...p,isPrimary:i===0,isRelated:i!==0,
  }))};
  const markers=orderedGeoMapMarkers(data);
  assert.deepEqual(markers.map(x=>x.zIndex),[998,999,1000]);
  assert.equal(markers.at(-1).point.id,'rio');
});

test('one-point tour marker stays highest; missing routes remain benign',()=>{
  const one={points:[sample.points[0]],route:[sample.points[0].coordinates]};
  assert.deepEqual(orderedGeoMapMarkers(one).map(x=>x.zIndex),[1000]);
  assert.deepEqual(orderedGeoMapMarkers({points:[],route:[]}),[]);
});


test('on a Destination map every earlier number covers every later number',()=>{
  // Up to ten co-located recommendations, independently of coordinates.
  const points=Array.from({length:11},(_,i)=>({
    id:'place-'+(i+1),position:i+1,coordinates:[-75.5,4.6],
    isPrimary:i===0,isRelated:i>0,
  }));
  const markers=orderedGeoMapMarkers({points,route:[]});
  assert.deepEqual(markers.map(x=>x.point.position),
    [11,10,9,8,7,6,5,4,3,2,1]);
  assert.deepEqual(markers.map(x=>x.zIndex),
    [990,991,992,993,994,995,996,997,998,999,1000]);
  const zByPosition=new Map(markers.map(x=>[x.point.position,x.zIndex]));
  assert.ok(zByPosition.get(7)>zByPosition.get(8));
  assert.ok(zByPosition.get(1)>zByPosition.get(2));
});

test('Yandex and Google honor the earlier-number-above-later rule on coincident pins',async()=>{
  const points=Array.from({length:8},(_,i)=>({
    id:'place-'+(i+1),name:'Место '+(i+1),position:i+1,
    coordinates:[-75.5,4.6],
    isPrimary:i===0,isRelated:i>0,
  }));
  const data={...sample,points,route:[],center:points[0].coordinates};
  const oldWindow=globalThis.window;
  class YMap{constructor(){this.children=[];}addChild(child){this.children.push(child);}}
  class Layer{constructor(props={}){this.props=props;}}
  class YMarker{constructor(props,element){this.props=props;this.element=element;}}
  class Listener{constructor(props){this.props=props;}}
  globalThis.window={ymaps3:{
    ready:Promise.resolve(),YMap,YMapDefaultSchemeLayer:Layer,
    YMapDefaultFeaturesLayer:Layer,YMapMarker:YMarker,YMapListener:Listener,
  }};
  try{
    const map=await renderYandexMap({clientWidth:400,clientHeight:445},data,
      'TEST',()=>{},async()=>{},p=>({id:p.id}));
    const markers=map.children.filter(x=>x instanceof YMarker);
    assert.deepEqual(markers.map(x=>x.element.id),
      ['place-8','place-7','place-6','place-5','place-4','place-3','place-2','place-1']);
    assert.deepEqual(markers.map(x=>x.props.zIndex),
      [993,994,995,996,997,998,999,1000]);
  }finally{globalThis.window=oldWindow;}

  const created=[];
  class GMap{}
  class GMarker{constructor(props){created.push(props);}addListener(){}}
  globalThis.window={google:{maps:{
    importLibrary:async name=>name==='maps'?{Map:GMap}:{AdvancedMarkerElement:null},
    Marker:GMarker,SymbolPath:{CIRCLE:0},
  }}};
  try{
    await renderGoogleMap({clientWidth:400,clientHeight:445},data,'TEST','',
      ()=>{},async()=>{},()=>({}),'en');
    assert.deepEqual(created.map(x=>x.title),
      ['Место 8','Место 7','Место 6','Место 5','Место 4','Место 3','Место 2','Место 1']);
    assert.deepEqual(created.map(x=>x.zIndex),
      [993,994,995,996,997,998,999,1000]);
  }finally{globalThis.window=oldWindow;}
});


test('Yandex search map redraws markers without constructing another map',async()=>{
  const prev=globalThis.window;
  let instances=0, children=[];
  class YMap {
    constructor(){instances++;this.children=[];}
    addChild(child){this.children.push(child);}
    removeChild(child){this.children=this.children.filter(x=>x!==child);}
    setLocation(location){this.location=location;}
  }
  class Layer{constructor(props={}){this.props=props;}}
  class YMarker{constructor(props,element){this.props=props;this.element=element;}}
  class Listener{constructor(props){this.props=props;}}
  globalThis.window={ymaps3:{
    ready:Promise.resolve(),YMap,YMapDefaultSchemeLayer:Layer,
    YMapDefaultFeaturesLayer:Layer,YMapMarker:YMarker,YMapListener:Listener,
  }};
  try {
    const {renderYandexMap,redrawYandexSearchPoints}=
      await import('../src/scripts/geo-map-yandex.mjs');
    const root={clientWidth:400,clientHeight:170};
    const data={...sample,route:[],points:sample.points.slice(0,2)};
    const map=await renderYandexMap(root,data,'TEST',()=>{},async()=>{},
      p=>({id:p.id}));
    const changed={...data,points:[sample.points[2]]};
    redrawYandexSearchPoints(map,root,changed,()=>{},p=>({id:p.id}));
    assert.equal(instances,1);
    assert.deepEqual(map.children.filter(x=>x instanceof YMarker)
      .map(x=>x.element.id),['lima']);
    assert.equal(map.location.zoom,fitGeoCamera(
      [sample.points[2].coordinates],{width:400,height:170,points:changed.points,pointZoom:8}).zoom);
    redrawYandexSearchPoints(map,root,{...changed,points:[]},()=>{},()=>({}));
    assert.equal(map.children.filter(x=>x instanceof YMarker).length,0);
    assert.equal(instances,1);
  }finally{globalThis.window=prev;}
});

test('Google search map redraws legacy pins without creating a second Map',async()=>{
  const prev=globalThis.window;
  let instances=0;
  class GMap {
    constructor(){instances++;}
    moveCamera(location){this.newLocation=location;}
  }
  class GMarker {
    constructor(props){this.props=props;this.map=props.map;}
    setMap(value){this.map=value;}
    addListener(){}
  }
  globalThis.window={google:{maps:{
    importLibrary:async kind=>kind==='maps'?{Map:GMap}:{AdvancedMarkerElement:null},
    Marker:GMarker,SymbolPath:{CIRCLE:0},
  }}};
  try{
    const {renderGoogleMap,redrawGoogleSearchPoints}=
      await import('../src/scripts/geo-map-google.mjs');
    const root={clientWidth:400,clientHeight:170};
    const init={...sample,route:[],points:sample.points.slice(0,2)};
    const map=await renderGoogleMap(root,init,'TEST','',()=>{},
      async()=>{},()=>({}),'ru');
    const next={...init,points:sample.points.slice(1)};
    redrawGoogleSearchPoints(map,root,next,()=>{},()=>({}));
    assert.equal(instances,1);
    assert.ok(map.newLocation.zoom>0);
    assert.equal(map.newLocation.center.lat,
      fitGeoCamera(next.points.map(p=>p.coordinates),
        {width:400,height:170,points:next.points,pointZoom:8}).center[1]);
  }finally{globalThis.window=prev;}
});
