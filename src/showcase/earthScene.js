import * as THREE from 'three';
import { heroFrame, storyFrame, localProgress, shipOrbit, spherePoint, SHIP_LINES } from './globeMath.js';

export function createEarthScene(root, land, onFailure) {
  const stage = root.querySelector('.earth-stage');
  const viewport = root.querySelector('.departure-viewport');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setClearColor(0, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,5000);
  camera.position.z = 2000;
  const world = new THREE.Group(), earth = new THREE.Group();
  scene.add(world); world.add(earth);
  const resources = [];
  const track = object => { resources.push(object); return object; };
  const geometry = positions => track(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)));
  const sphere = new THREE.Mesh(track(new THREE.SphereGeometry(1,64,48)), track(new THREE.MeshBasicMaterial({ colorWrite: false })));
  sphere.renderOrder = -1; earth.add(sphere);
  const pointsMaterial = track(new THREE.ShaderMaterial({
    uniforms: { size: { value: 2 }, ink: { value: new THREE.Color('#8a8c80') }, green: { value: 0 }, blue: { value: 0 }, focusLon: { value: 0 } },
    vertexShader: 'uniform float size; varying vec3 landPosition; void main(){ landPosition=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize=size; }',
    fragmentShader: 'uniform vec3 ink; uniform float green; uniform float blue; uniform float focusLon; varying vec3 landPosition; void main(){ float d=length(gl_PointCoord-vec2(.5)); if(d>.5) discard; float region=smoothstep(.72,.92,dot(landPosition,vec3(sin(focusLon),0.,cos(focusLon)))); vec3 color=mix(ink,vec3(.66,.48,.18),region*.85); color=mix(color,vec3(.40,.56,.22),green*smoothstep(-.7,.4,landPosition.y)); color=mix(color,vec3(.27,.48,.66),blue*(1.-smoothstep(-.3,.6,landPosition.y))); gl_FragColor=vec4(color,.7*(1.0-smoothstep(.32,.5,d))); }',
    transparent: true, depthWrite: false,
  }));
  const pointGeometry = geometry(land.points);
  const dots = new THREE.Points(pointGeometry,pointsMaterial); earth.add(dots);
  const coast = new THREE.LineSegments(geometry(land.coast),track(new THREE.LineBasicMaterial({color:'#798c85', transparent:true,opacity:.48})));
  earth.add(coast);
  const grid = [];
  const add = (a,b) => grid.push(...spherePoint(...a,1.001),...spherePoint(...b,1.001));
  for(let lat=-75;lat<=75;lat+=15) for(let lon=-180;lon<180;lon+=2) add([lat,lon],[lat,lon+2]);
  for(let lon=-180;lon<180;lon+=15) for(let lat=-90;lat<90;lat+=2) add([lat,lon],[lat+2,lon]);
  earth.add(new THREE.LineSegments(geometry(grid),track(new THREE.LineBasicMaterial({color:'#a8b1a6',transparent:true,opacity:.30}))));
  const limb = [];
  for(let i=0;i<=180;i++){ const a=i*Math.PI/90;limb.push(Math.cos(a),Math.sin(a),0); }
  world.add(new THREE.Line(geometry(limb),track(new THREE.LineBasicMaterial({color:'#a1aaa0',transparent:true,opacity:.7}))));
  const ship = new THREE.Group(), segments=[];
  for(const line of SHIP_LINES) for(let i=1;i<line.length;i++) segments.push(...line[i-1],0,...line[i],0);
  ship.add(new THREE.LineSegments(geometry(segments),track(new THREE.LineBasicMaterial({color:'#b7d7c7'}))));
  const lights=[];
  for(let i=0;i<5;i++) lights.push(-.105+i*.026,-.014,.006,-.095+i*.026,-.014,.006);
  ship.add(new THREE.LineSegments(geometry(lights),track(new THREE.LineBasicMaterial({color:'#bd8050'}))));
  world.add(ship);
  let disposed=false, paused=false, near=true, raf=0, width=0, height=0, progress=0, frames=0;
  let timer=0, excerpt=0, previousPhase=-1;
  const excerpts=[...root.querySelectorAll('[data-excerpt]')];
  const selectors=[...root.querySelectorAll('[data-excerpt-select]')];
  function showExcerpt(index) {
    excerpt=index;
    excerpts.forEach((el,i)=>{el.hidden=i!==index;});
    selectors.forEach((el,i)=>el.setAttribute('aria-pressed',String(i===index)));
    root.dataset.excerpt=String(index);
  }
  function cycle() {
    clearTimeout(timer);timer=0;
    if(!disposed && !paused && near && !document.hidden && progress<.24 && root.dataset.flow!=='true' && excerpts.length) {
      timer=setTimeout(()=>{showExcerpt((excerpt+1)%excerpts.length);schedule();cycle();},7000);
    }
  }
  const panels=[...root.querySelectorAll('[data-story-phase]')];
  function draw() {
    raf=0;
    if(disposed || document.hidden || !near) return;
    let rect=viewport.getBoundingClientRect();
    const compact=rect.width<760;
    const available=window.innerHeight || rect.height+68;
    const flow=available<(compact?600:640);
    root.dataset.flow=String(flow);
    rect=viewport.getBoundingClientRect();
    if(flow)rect={width:rect.width,height:Math.min(700,available)};
    if(rect.width!==width || rect.height!==height) {
      width=rect.width; height=rect.height;
      const dpr=Math.min(devicePixelRatio,compact?1.5:2);
      renderer.setPixelRatio(dpr); renderer.setSize(width,height,false);
      camera.left=-width/2; camera.right=width/2; camera.top=height/2; camera.bottom=-height/2; camera.updateProjectionMatrix();
      pointsMaterial.uniforms.size.value=(compact?1.35:1.65)*dpr;
      // Fibonacci order is stable across resize; compact selects every third point.
      const indices=Array.from({length:Math.ceil(land.points.length/3/(compact?3:1))},(_,i)=>i*(compact?3:1));
      pointGeometry.setIndex(indices);
    }
    {
      const bounds=root.getBoundingClientRect();
      const header=document.querySelector('#afflatus-header')?.getBoundingClientRect().height || 0;
      progress=localProgress(bounds.top,bounds.height,height+header,header);
    }
    if(flow)progress=0;
    const key=heroFrame(progress), story=storyFrame(progress);
    const sectors=root.classList.contains('sectors-earth');
    const radius=sectors
      ? Math.min(width*(compact?.52:.335),height*(compact?.34:.58))*key.scale
      : Math.min(width*(compact?.42:.27),height*(compact?.24:.5))*key.scale;
    const cx=width*(sectors?.5:(compact?.5:.63)), cy=height*(sectors?(compact?.43:.53):(compact?.35:.55));
    world.position.set(cx-width/2,height/2-cy,0); world.scale.setScalar(radius);
    earth.rotation.set(key.pitch,key.yaw,0,'XYZ');
    const orbit=shipOrbit(key.orbit); ship.position.set(...orbit.position); ship.rotation.z=orbit.angle;
    // Keep the optional ship within the viewport even when the globe fills it.
    ship.scale.setScalar(sectors?.30:.45);
    ship.position.x=Math.max((32-cx)/radius,Math.min((width-cx-36)/radius,ship.position.x));
    const phase=story.phase;
    if(phase!==previousPhase) { showExcerpt(phase % Math.max(1,excerpts.length)); previousPhase=phase; }
    pointsMaterial.uniforms.green.value=story.green;
    pointsMaterial.uniforms.blue.value=story.blue;
    pointsMaterial.uniforms.focusLon.value=[-.6,.2,1][excerpt];
    for(let i=0;i<panels.length;i++) {
      if(flow) {
        panels[i].style.removeProperty('opacity');panels[i].style.removeProperty('visibility');
        panels[i].style.removeProperty('transform');panels[i].removeAttribute('aria-hidden');
      } else {
        panels[i].style.opacity=String(story.weights[i]);
        panels[i].style.visibility=story.weights[i]>0?'visible':'hidden';
        panels[i].style.transform=`translateY(${(i-phase)*18*(1-story.weights[i])}px)`;
        panels[i].setAttribute('aria-hidden',String(i!==phase));
      }
    }
    root.dataset.progress=progress.toFixed(4); root.dataset.phase=String(phase);
    root.dataset.renderFrames=String(++frames);
    if(!flow)renderer.render(scene,camera);
    cycle();
  }
  function schedule(){ if(!disposed && !raf && !document.hidden && near) raf=requestAnimationFrame(draw); }
  function scroll(){ schedule(); cycle(); }
  function visibility(){ if(document.hidden){cancelAnimationFrame(raf);raf=0;}else schedule(); cycle(); }
  function lost(event){ event.preventDefault(); destroy(); onFailure(); }
  const observer=new IntersectionObserver(entries=>{near=entries[0].isIntersecting;if(near)schedule();else{cancelAnimationFrame(raf);raf=0;}cycle();},{rootMargin:'100px'});
  const resize=new ResizeObserver(schedule);
  function destroy(){
    if(disposed)return;disposed=true;clearTimeout(timer);cancelAnimationFrame(raf);observer.disconnect();resize.disconnect();
    window.removeEventListener('scroll',scroll);window.removeEventListener('resize',schedule);window.removeEventListener('pageshow',schedule);
    document.removeEventListener('visibilitychange',visibility);
    renderer.domElement.removeEventListener('webglcontextlost',lost);
    renderer.domElement.remove(); resources.forEach(r=>r.dispose());renderer.dispose();
    delete root.dataset.enhanced;delete root.dataset.flow;delete root.dataset.excerpt;delete root.dataset.progress;delete root.dataset.phase;delete root.dataset.renderFrames;
    panels.forEach(panel=>{panel.style.removeProperty('transform');panel.style.removeProperty('opacity');panel.style.removeProperty('visibility');panel.removeAttribute('aria-hidden');});
  }
  try {
    stage.append(renderer.domElement);root.dataset.enhanced='true';root.removeAttribute('data-pending');
    observer.observe(root);resize.observe(viewport);
    window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',schedule);window.addEventListener('pageshow',schedule);
    document.addEventListener('visibilitychange',visibility);renderer.domElement.addEventListener('webglcontextlost',lost);
    draw();cycle();
  } catch(error){destroy();throw error;}
  return { setPaused(value){paused=value;schedule();cycle();}, selectExcerpt(index){showExcerpt(index);paused=true;clearTimeout(timer);schedule();}, destroy };
}
