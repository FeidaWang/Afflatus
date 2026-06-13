/**
 * Three.js holographic projection of the Enforcer mothership for the terminal
 * login screen: translucent cyan fills + bright wireframe edges + glowing
 * engine/muzzle discs, slowly rotating. Rendered to its own small canvas and
 * gated (only runs while the login screen is visible).
 */
import * as THREE from 'three';

export function createShipHologram(canvas) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
  catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  scene.add(new THREE.AmbientLight(0x335577, 2));
  const key = new THREE.DirectionalLight(0x9fe6ff, 1.4); key.position.set(4, 6, 5); scene.add(key);

  const fillMat = new THREE.MeshBasicMaterial({ color: 0x4fb8e8, transparent: true, opacity: 0.16 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x9af0ff, transparent: true, opacity: 0.85 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xcdf6ff, transparent: true, opacity: 0.9 });

  // translucent body + wireframe edges
  const part = (geo, t, s, r) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, fillMat));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    if (t) g.position.set(...t);
    if (s) g.scale.set(...s);
    if (r) g.rotation.set(...r);
    return g;
  };

  const ship = new THREE.Group();
  ship.add(part(new THREE.SphereGeometry(1, 18, 12), [0, 0, 0], [0.85, 0.6, 2.8]));        // hull
  ship.add(part(new THREE.ConeGeometry(0.55, 1.5, 16), [0, 0, 3], null, [Math.PI / 2, 0, 0])); // nose
  ship.add(part(new THREE.SphereGeometry(0.55, 14, 10), [0, 0.45, 0.7], [0.7, 0.6, 1]));   // cockpit
  ship.add(part(new THREE.CylinderGeometry(0.16, 0.2, 2.3, 12), [0, 0.05, 2.6], null, [Math.PI / 2, 0, 0])); // main gun
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), glowMat);
  muzzle.position.set(0, 0.05, 3.85); ship.add(muzzle);
  for (const sx of [-0.78, 0.78]) {
    ship.add(part(new THREE.CylinderGeometry(0.4, 0.48, 1.6, 14), [sx, -0.05, -1.9], null, [Math.PI / 2, 0, 0])); // nacelle
    const bell = new THREE.Mesh(new THREE.CircleGeometry(0.3, 14), glowMat);
    bell.position.set(sx, -0.05, -2.74); bell.rotation.y = Math.PI; ship.add(bell);
  }
  for (const sx of [-1, 1]) {
    ship.add(part(new THREE.BoxGeometry(1, 0.2, 0.5), [sx * 0.9, -0.1, 0.4], null, [0, 0, sx * 0.12])); // weapon pod
    ship.add(part(new THREE.CylinderGeometry(0.07, 0.09, 1.2, 10), [sx * 1.45, -0.1, 1.1], null, [Math.PI / 2, 0, 0])); // barrel
  }
  ship.scale.setScalar(0.78);
  ship.rotation.x = 0.32;
  scene.add(ship);

  camera.position.set(0, 1.3, 10); camera.lookAt(0, 0, 0);

  let raf = 0, active = false, start = performance.now();
  function frame(now) {
    const w = canvas.clientWidth || 120, h = canvas.clientHeight || 150;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const ww = Math.max(2, Math.floor(w * dpr)), hh = Math.max(2, Math.floor(h * dpr));
    if (canvas.width !== ww || canvas.height !== hh) { renderer.setSize(ww, hh, false); camera.aspect = ww / hh; camera.updateProjectionMatrix(); }
    ship.rotation.y = (now - start) / 3400 + 0.4;
    muzzle.material.opacity = 0.55 + 0.4 * Math.sin(now / 320);
    renderer.render(scene, camera);
  }
  function loop() { if (active) { frame(performance.now()); raf = requestAnimationFrame(loop); } }
  function setActive(on) {
    if (on === active) return;
    active = on;
    if (on) { start = performance.now(); raf = requestAnimationFrame(loop); }
    else cancelAnimationFrame(raf);
  }
  return { setActive };
}
