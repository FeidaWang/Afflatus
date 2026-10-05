import {loadGlobeAsset} from '../../showcase/globeAsset.js';
import {projectXyz,projectLatLon} from '../stage/projection.js';
export function createGlobe(canvas,companies,{hero=false}={}) {
 const ctx=canvas.getContext('2d'); if(!ctx) return {update(){},zoom(){},reset(){},dispose(){}};
 let land,selected=companies,width=0,height=0,lon=hero?-75:10,lat=20,scale=1,drag,disposed=false;
 const colors={US:'#547a97',CN:'#aa785e'};
 function draw(){
  canvas.dataset.zoom=String(scale);canvas.dataset.longitude=String(lon);
  if(disposed||!width||!height)return;
  const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const radius=(hero?Math.min(width*(width<620?.4:.32),height*.58):Math.min(width*.39,height*.41))*scale;
  const v={lat0:lat,lon0:lon,radius,cx:width/2,cy:height*(hero?.5:.47)};
  ctx.lineWidth=.6;ctx.strokeStyle='#827e7132';ctx.beginPath();ctx.arc(v.cx,v.cy,radius,0,Math.PI*2);ctx.stroke();
  // A geographic graticule and genuine Natural Earth coastlines, not illustrative geometry.
  ctx.strokeStyle='#817d7020';
  for(let mode=0;mode<2;mode++)for(let fixed=mode?-150:-60;fixed<=(mode?180:60);fixed+=30){ctx.beginPath();let first=true;for(let a=mode?-90:-180;a<=(mode?90:180);a+=3){const p=projectLatLon(mode?a:fixed,mode?fixed:a,v);if(!p.visible){first=true;continue;}if(first)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);first=false;}ctx.stroke();}
  if(land){
   ctx.fillStyle=hero?'#625f5480':'#625f5455';ctx.beginPath();for(let i=0;i<land.points.length;i+=3){const p=projectXyz(land.points.slice(i,i+3),v);if(p.visible){ctx.moveTo(p.x+.65,p.y);ctx.arc(p.x,p.y,hero?.55:.6,0,Math.PI*2);}}ctx.fill();
   ctx.strokeStyle=hero?'#6c685c60':'#6c685c38';ctx.beginPath();for(let i=0;i<land.coast.length;i+=6){const a=projectXyz(land.coast.slice(i,i+3),v),b=projectXyz(land.coast.slice(i+3,i+6),v);if(a.visible&&b.visible){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}}ctx.stroke();
  }
  for(const c of selected){const p=projectLatLon(c.lat,c.lon,v);if(!p.visible)continue;ctx.fillStyle=colors[c.country]||'#768548';ctx.globalAlpha=hero?.5:.72;ctx.beginPath();ctx.arc(p.x,p.y,hero?2:3,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
 }
 const resize=new ResizeObserver(entries=>{const box=entries[0].contentRect;width=box.width;height=box.height;draw();});resize.observe(canvas);
 loadGlobeAsset().then(d=>{land=d;draw();}).catch(()=>{canvas.dataset.fallback='true';draw();});
 if(!hero){canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,lon,lat};canvas.setPointerCapture(event.pointerId);});canvas.addEventListener('pointermove',event=>{if(!drag)return;lon=drag.lon-(event.clientX-drag.x)*.35;lat=Math.max(-60,Math.min(60,drag.lat+(event.clientY-drag.y)*.25));draw();});const end=()=>{drag=undefined;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);}
 return {update(rows,{longitude}={}){selected=rows;if(longitude!=null)lon=longitude;draw();},zoom(direction){scale=Math.max(.75,Math.min(2,scale+direction*.25));draw();},reset(){scale=1;lon=10;lat=20;draw();},dispose(){disposed=true;resize.disconnect();}};
}
