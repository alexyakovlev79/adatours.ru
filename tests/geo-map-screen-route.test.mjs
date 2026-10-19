import test from 'node:test';
import assert from 'node:assert/strict';
import {coordinateKey,screenRouteGeometry} from '../src/lib/geo-map-screen-route.mjs';
import {renderYandexMap} from '../src/scripts/geo-map-yandex.mjs';

const points=[
  [-43.20555556,-22.91111111],[-43.15666670,-22.94944440],
  [-54.58750000,-25.54000000],[-54.57355000,-25.59912000],
  [-58.37723000,-34.61315000],[-77.03750000,-12.06000000],
  [-71.97861111,-13.51694444],[-71.98221900,-13.50778100],
  [-72.54555556,-13.16333333],[-70.02198000,-15.84003000],
];
const positions=[
  [780,250],[782,251],[640,285],[642,286],[610,410],
  [360,130],[410,155],[412,154],[405,153],[434,170],
];
const viewport={left:100,top:50,width:1030,height:480};
function rectangles(shiftX=0,shiftY=0){
  const result=new Map();
  points.forEach((point,i)=>result.set(coordinateKey(point),{
    left:viewport.left+positions[i][0]+shiftX-19,
    top:viewport.top+positions[i][1]+shiftY-19,
    width:38,height:38,
  }));
  return result;
}

test('South America route segments anchor to actual pins, not Pacific ghost lines',()=>{
  const {segments,arrows}=screenRouteGeometry(points,rectangles(),viewport);
  assert.ok(segments.length>3);
  assert.ok(segments.every(s=>s.x1>200&&s.x2>200));
  assert.ok(segments.every(s=>s.x1<900&&s.x2<900));
  assert.ok(arrows.length>0&&arrows.length<points.length-1);
});

test('route moves when the map moves its marker DOM',()=>{
  const before=screenRouteGeometry(points,rectangles(),viewport);
  const after=screenRouteGeometry(points,rectangles(120,-50),viewport);
  assert.equal(after.segments.length,before.segments.length);
  for(let i=0;i<before.segments.length;i++){
    assert.ok(Math.abs(after.segments[i].x1-before.segments[i].x1-120)<1e-6);
    assert.ok(Math.abs(after.segments[i].y1-before.segments[i].y1+50)<1e-6);
  }
});

test('repeated world copies never cause an ocean-spanning line',()=>{
  const route=[[179,5],[-179,4]];
  const rects=new Map([
    [coordinateKey(route[0]),{left:100,top:80,width:38,height:38}],
    [coordinateKey(route[1]),{left:900,top:85,width:38,height:38}],
  ]);
  assert.equal(screenRouteGeometry(route,rects,viewport).segments.length,0);
  rects.get(coordinateKey(route[1])).left=151;
  assert.equal(screenRouteGeometry(route,rects,viewport).segments.length,1);
});

test('Yandex draws routes from pin rectangles and never uses native YMapFeature',async()=>{
  const old={window:globalThis.window,document:globalThis.document,
    requestAnimationFrame:globalThis.requestAnimationFrame};
  const scheduled=[];
  globalThis.requestAnimationFrame=cb=>{scheduled.push(cb);return scheduled.length;};
  const flush=()=>{while(scheduled.length)scheduled.shift()();};
  let overlay;
  const makeSvg=tag=>({
    tag,attributes:{},children:[],isConnected:true,
    setAttribute(k,v){this.attributes[k]=String(v);},
    classList:{add(){}},
    getBoundingClientRect(){return viewport;},
    replaceChildren(...x){this.children=x;},
  });
  globalThis.document={createElementNS:(_ns,tag)=>makeSvg(tag)};
  const wrapper={querySelector:()=>overlay,appendChild:node=>{overlay=node;}};
  const rects=rectangles();
  class Map{
    constructor(root,props){this.root=root;this.props=props;this.children=[];}
    addChild(child){this.children.push(child);return this;}
  }
  class Layer{constructor(props){this.props=props;}}
  class Marker{constructor(props,element){this.props=props;this.element=element;}}
  class Listener{constructor(props){this.props=props;}}
  class BadFeature{constructor(){throw Error('Native feature line forbidden');}}
  globalThis.window={ymaps3:{
    ready:Promise.resolve(),YMap:Map,YMapDefaultSchemeLayer:Layer,
    YMapDefaultFeaturesLayer:Layer,YMapMarker:Marker,
    YMapListener:Listener,YMapFeature:BadFeature,
  }};
  try{
    const data={points:points.map((coords,i)=>({id:String(i),coordinates:coords})),
      route:points,center:points[0],zoom:5};
    const root={clientWidth:1030,clientHeight:480,parentElement:wrapper};
    const map=await renderYandexMap(root,data,'TEST_KEY',()=>{},async()=>{},p=>({
      isConnected:true,getBoundingClientRect:()=>rects.get(coordinateKey(p.coordinates)),
    }));
    flush();
    assert.equal(map.children.filter(x=>x instanceof Marker).length,points.length);
    assert.equal(map.children.filter(x=>x instanceof Listener).length,1);
    assert.equal(map.children.filter(x=>x instanceof Layer).length,2);
    assert.ok(overlay.children.length>4);
    assert.ok(overlay.children.every(x=>/^[ML 0-9.\-]+(Z)?$/.test(x.attributes.d)));
    const before=overlay.children.map(x=>x.attributes.d);
    rects.get(coordinateKey(points[0])).left+=50;
    map.children.find(x=>x instanceof Listener).props.onUpdate({location:{zoom:5}});
    flush();
    assert.notDeepEqual(overlay.children.map(x=>x.attributes.d),before);
  }finally{
    for(const [k,v] of Object.entries(old)){
      if(v===undefined)delete globalThis[k];else globalThis[k]=v;
    }
  }
});
