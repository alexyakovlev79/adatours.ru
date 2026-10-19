import test from 'node:test';
import assert from 'node:assert/strict';
import {fitGeoCamera,geoToWorld,MAP_MARKER_DIAMETER,MAP_PRIMARY_MARKER_DIAMETER,
  DESKTOP_UPWARD_SHIFT_PX,MOBILE_UPWARD_SHIFT_PX} from '../src/lib/geo-map-camera.mjs';
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


function visibleCircleGaps(coordinates, camera, width, height, primaryId = -1) {
  const markers=coordinates.map((coordinate,i)=>{
    const {x,y}=screenPoint(coordinate,camera,width,height);
    const radius=(i===primaryId?MAP_PRIMARY_MARKER_DIAMETER:MAP_MARKER_DIAMETER)/2;
    return {left:x-radius,right:width-x-radius,top:y-radius,bottom:height-y-radius};
  });
  return {
    left:Math.min(...markers.map(p=>p.left)),
    right:Math.min(...markers.map(p=>p.right)),
    top:Math.min(...markers.map(p=>p.top)),
    bottom:Math.min(...markers.map(p=>p.bottom)),
  };
}

for (const [width,height] of [[1030,480],[360,445],[390,445],[320,445],[1200,700]]) {
  test('complete South America itinerary fits marker edges tightly at '+width+'x'+height,()=>{
    const camera=fitGeoCamera(itinerary,{width,height});
    assert.ok(camera);
    const gaps=visibleCircleGaps(itinerary,camera,width,height);
    // Every 38px circle must be completely within the map canvas.
    for(const gap of Object.values(gaps))
      assert.ok(gap>=-0.01,'Clipped marker at '+width+'x'+height+': '+JSON.stringify(gaps));
    const tightX=gaps.left<=MAP_MARKER_DIAMETER+0.01 && gaps.right<=MAP_MARKER_DIAMETER+0.01;
    // The upward camera offset transfers clearance from top to bottom;
    // the combined vertical margin still checks the original tight zoom.
    const tightY=gaps.top+gaps.bottom<=2*MAP_MARKER_DIAMETER+0.02;
    assert.ok(tightX||tightY,'No limiting axis at '+width+'x'+height+': '+JSON.stringify(gaps));
    assert.ok(camera.zoom>2&&camera.zoom<6);
  });
}

test('the wide map is height-constrained; mobile is width-constrained',()=>{
  const desktop=fitGeoCamera(itinerary,{width:1030,height:480});
  const mobile=fitGeoCamera(itinerary,{width:360,height:445});
  const deskGaps=visibleCircleGaps(itinerary,desktop,1030,480);
  const mobileGaps=visibleCircleGaps(itinerary,mobile,360,445);
  assert.ok(deskGaps.top+deskGaps.bottom<=2*MAP_MARKER_DIAMETER+0.02);
  assert.ok(mobileGaps.left<=MAP_MARKER_DIAMETER && mobileGaps.right<=MAP_MARKER_DIAMETER);
  assert.notEqual(desktop.zoom,mobile.zoom);
});

test('featured 44px marker stays fully on-screen with tight combined limiting margins',()=>{
  const places=[[-75.5,4.6],[-75.48,4.63],[-75.57,4.64],[-74.5,5.2]];
  for(const [width,height] of [[1030,480],[360,445]]) {
    const points=places.map((coordinates,i)=>({coordinates,isPrimary:i===0}));
    const camera=fitGeoCamera(places,{width,height,points});
    const gaps=visibleCircleGaps(places,camera,width,height,0);
    assert.ok(Object.values(gaps).every(gap=>gap>=-0.01));
    assert.ok(
      (gaps.left<=MAP_MARKER_DIAMETER && gaps.right<=MAP_MARKER_DIAMETER) ||
      (gaps.top+gaps.bottom<=2*MAP_MARKER_DIAMETER+0.02)
    );
  }
});

test('single-point maps keep their type zoom and move the marker upward',()=>{
  const coord = itinerary[0];
  for (const [width,height,expected] of [
    [1030,480,DESKTOP_UPWARD_SHIFT_PX],
    [360,445,MOBILE_UPWARD_SHIFT_PX],
  ]) {
    const camera = fitGeoCamera([coord],{width,height,pointZoom:10});
    assert.equal(camera.zoom,10);
    const pixel = screenPoint(coord,camera,width,height);
    assert.ok(Math.abs(pixel.x-width/2)<1e-6);
    assert.ok(Math.abs(pixel.y-(height/2-expected))<1e-6);
  }
  assert.equal(fitGeoCamera([coord],{pointZoom:17}).zoom,17);
});

test('all route points move up by the requested desktop and mobile amounts',()=>{
  for (const [width,height,expected] of [
    [1030,480,DESKTOP_UPWARD_SHIFT_PX],
    [360,445,MOBILE_UPWARD_SHIFT_PX],
    [390,445,MOBILE_UPWARD_SHIFT_PX],
  ]) {
    const final = fitGeoCamera(itinerary,{width,height});
    const middle = Math.min(...itinerary.map(p=>screenPoint(p,final,width,height).y));
    const topCircleGap = middle - MAP_MARKER_DIAMETER/2;
    // The old fit had 34.2px of headroom on height-constrained maps.
    const oldYcenter=(Math.min(...itinerary.map(p=>geoToWorld(p)[1]))+
      Math.max(...itinerary.map(p=>geoToWorld(p)[1])))/2;
    const oldZoom=final.zoom;
    const oldCenterWorld=geoToWorld(final.center);
    const actualShift=(oldCenterWorld[1]-oldYcenter)*256*2**oldZoom;
    assert.ok(Math.abs(actualShift-expected)<1e-6,
      JSON.stringify({width,expected,actualShift}));
    assert.ok(topCircleGap>=3-1e-6,'Top marker clipped');
  }
});

test('upward offset is clamped when the topmost circle is near the border',()=>{
  // Height-constrained map: the requested 38px mobile shift must not cut
  // off the circle already about one diameter from the top.
  const points=[[0,80],[0,-80]];
  const cam=fitGeoCamera(points,{width:360,height:300});
  const top=Math.min(...points.map(p=>screenPoint(p,cam,360,300).y))-
    MAP_MARKER_DIAMETER/2;
  assert.ok(top>=3-1e-6, 'Clamped shift must retain the entire topmost pin');
  assert.ok(Math.abs(screenPoint(points[0],cam,360,300).x-180)<1e-6);
});

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
