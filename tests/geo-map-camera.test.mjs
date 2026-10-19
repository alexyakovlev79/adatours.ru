import test from 'node:test';
import assert from 'node:assert/strict';
import {fitGeoCamera,geoToWorld,DEFAULT_INITIAL_ZOOM_BOOST} from '../src/lib/geo-map-camera.mjs';
import {routeDirectionArrows,routeLegs} from '../src/lib/geo-map-direction.mjs';

// Actual coordinates of confirmed destinations on Ada Tours' Brazil/Argentina/Peru pilot.
const itinerary = [
  [-43.20555556,-22.91111111], // Rio de Janeiro
  [-43.15666670,-22.94944440], // Sugarloaf Mountain
  [-54.58750000,-25.54000000], // Foz do Iguacu
  [-54.57355000,-25.59912000], // Puerto Iguazu
  [-58.37723000,-34.61315000], // Buenos Aires
  [-77.03750000,-12.06000000], // Lima
  [-71.97861111,-13.51694444], // Cusco
  [-71.98221900,-13.50778100], // Sacsayhuaman
  [-72.54555556,-13.16333333], // Machu Picchu
  [-70.02198000,-15.84003000], // Puno/Titicaca
];

function screenPoint(coordinate,camera,width,height) {
  const [x,y]=geoToWorld(coordinate);
  const [cx,cy]=geoToWorld(camera.center);
  let dx=x-cx;
  if(dx>.5)dx-=1;
  if(dx<-.5)dx+=1;
  const scale=256*2**camera.zoom;
  return {x:width/2+dx*scale,y:height/2+(y-cy)*scale};
}

for(const [width,height] of [[1030,480],[360,445],[1200,700]]) {
  test('all South America pilot points fit in '+width+'x'+height,()=>{
    const camera=fitGeoCamera(itinerary,{width,height,zoomBoost:0});
    assert.ok(camera);
    assert.ok(camera.zoom>2 && camera.zoom<6);
    for(const place of itinerary) {
      const pixel=screenPoint(place,camera,width,height);
      assert.ok(pixel.x>=55&&pixel.x<=width-55,JSON.stringify(pixel));
      assert.ok(pixel.y>=75&&pixel.y<=height-75,JSON.stringify(pixel));
    }
  });
}

test('single-place maps use the same closer starting view without moving the center',()=>{
  assert.deepEqual(fitGeoCamera([itinerary[0]],{width:360,height:445,pointZoom:10}),{
    center:itinerary[0],zoom:10+DEFAULT_INITIAL_ZOOM_BOOST,
  });
  assert.equal(fitGeoCamera([itinerary[0]],{pointZoom:17}).zoom,17);
});

for (const [width,height] of [[1030,480],[360,445],[1200,700]]) {
  test('default zoom matches two mouse-wheel increments at '+width+'x'+height,()=>{
    const fit=fitGeoCamera(itinerary,{width,height,zoomBoost:0});
    const initial=fitGeoCamera(itinerary,{width,height});
    assert.deepEqual(initial.center,fit.center);
    assert.ok(Math.abs(initial.zoom-fit.zoom-DEFAULT_INITIAL_ZOOM_BOOST)<1e-10);
    const scale=Math.pow(2,initial.zoom-fit.zoom);
    assert.ok(scale>1.50&&scale<1.53,'Expected approximately 1.52x screenshot magnification');
  });
}


test('180th meridian uses the short longitude arc',()=>{
  const camera=fitGeoCamera([[179,-15],[-179,-16]],{width:800,height:480});
  assert.ok(Math.abs(Math.abs(camera.center[0])-180)<1);
  assert.ok(camera.zoom>4);
});

test('direction arrow bearings follow east/north/west and skip zero segments',()=>{
  const east=routeDirectionArrows([[0,0],[10,0]],{zoom:5});
  const north=routeDirectionArrows([[0,0],[0,10]],{zoom:5});
  const west=routeDirectionArrows([[10,0],[0,0]],{zoom:5});
  assert.equal(Math.round(east[0].angle),0);
  assert.equal(Math.round(north[0].angle),-90);
  assert.equal(Math.round(west[0].angle),180);
  assert.equal(routeDirectionArrows([[0,0],[0,0]],{zoom:5}).length,0);
  assert.equal(routeDirectionArrows([[0,0],[0.00001,0.00001]],{zoom:4}).length,0);
});

test('long legs get arrows but nearby landmarks do not crowd the overview',()=>{
  const camera=fitGeoCamera(itinerary,{width:1030,height:480});
  const arrows=routeDirectionArrows(itinerary,{zoom:camera.zoom});
  assert.ok(arrows.length>=3);
  assert.ok(arrows.length<itinerary.length-1);
  assert.ok(!arrows.some(a=>a.segment===1)); // Rio -> Sugarloaf
  for(const arrow of arrows){
    assert.ok(arrow.coordinates.every(Number.isFinite));
    assert.ok(Number.isFinite(arrow.angle));
  }
});

test('South American route draws only its local legs, never a stray Pacific segment',()=>{
  const legs=routeLegs(itinerary);
  assert.equal(legs.length,itinerary.length-1);
  for(const {coordinates} of legs){
    assert.equal(coordinates.length,2);
    for(const [lng,lat] of coordinates) {
      assert.ok(lng>=-78 && lng<=-43, 'Unexpected longitude: '+lng);
      assert.ok(lat>=-35 && lat<=-12, 'Unexpected latitude: '+lat);
    }
  }
});

test('dateline travel splits into two short legs instead of a line around the world',()=>{
  const legs=routeLegs([[179,-15],[-179,-16]]);
  assert.equal(legs.length,2);
  assert.equal(legs[0].coordinates[1][0],180);
  assert.equal(legs[1].coordinates[0][0],-180);
  assert.ok(legs.every(x=>Math.abs(x.coordinates[1][0]-x.coordinates[0][0])<=2));
  assert.equal(routeLegs([[0,0],[0,0]]).length,0);
  assert.equal(routeLegs([[0,0],[NaN,0],[1,1]]).length,0);
});
