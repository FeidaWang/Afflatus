/**
 * Three.js holographic projection of the Enforcer mothership (fig2 "Executor":
 * elongated hull, raised twin ribbed engine pods on pylons, side outrigger arms
 * with weapon pods, cockpit, forward main gun). Translucent cyan fills + bright
 * wireframe edges + glowing engine/muzzle discs, slowly rotating.
 *
 * Renders into the supplied canvas with a FIXED-size buffer that CSS scales to
 * fill the box — so it never depends on clientWidth (the previous blank-render
 * cause) and always shows.
 */
import * as THREE from 'three';

export function createShipHologram(canvas) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
  catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  const RW = 240, RH = 300;
  renderer.setSize(RW, RH, false);   // fixed buffer; CSS scales the canvas to fill

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, RW / RH, 0.1, 100);
  scene.add(new THREE.AmbientLight(0x335577, 2));
  const key = new THREE.DirectionalLight(0x9fe6ff, 1.4); key.position.set(4, 6, 5); scene.add(key);

  const fillMat = new THREE.MeshBasicMaterial({ color: 0x3aa8e0, transparent: true, opacity: 0.14 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x9af0ff, transparent: true, opacity: 0.9 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xcdf6ff, transparent: true, opacity: 0.95 });

  // translucent body + wireframe edges, positioned/scaled/rotated
  const part = (geo, t, s, r) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, fillMat));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    if (t) g.position.set(t[0], t[1], t[2]);
    if (s) g.scale.set(s[0], s[1], s[2]);
    if (r) g.rotation.set(r[0], r[1], r[2]);
    return g;
  };

  const ship = new THREE.Group();
  // central hull (nose +Z, stern -Z)
  ship.add(part(new THREE.CylinderGeometry(0.55, 0.42, 4.0, 12), [0, 0, 0], null, [Math.PI / 2, 0, 0]));
  ship.add(part(new THREE.ConeGeometry(0.42, 1.5, 12), [0, 0, 2.75], null, [Math.PI / 2, 0, 0]));   // nose
  ship.add(part(new THREE.SphereGeometry(0.42, 12, 9), [0, 0.34, 0.8], [0.8, 0.6, 1]));               // cockpit
  // forward main gun
  ship.add(part(new THREE.CylinderGeometry(0.1, 0.14, 1.9, 10), [0, 0.04, 2.4], null, [Math.PI / 2, 0, 0]));
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 7), glowMat);
  muzzle.position.set(0, 0.04, 3.45); ship.add(muzzle);
  // raised twin engine pods on pylons (the Executor's signature) + live plumes
  const plumeMat = new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const plumes = [];
  for (const sx of [-0.66, 0.66]) {
    ship.add(part(new THREE.CylinderGeometry(0.34, 0.4, 1.9, 12), [sx, 0.5, -1.55], null, [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 3; i++) ship.add(part(new THREE.TorusGeometry(0.38, 0.05, 6, 14), [sx, 0.5, -1.0 + i * 0.5]));
    ship.add(part(new THREE.BoxGeometry(0.16, 0.72, 0.7), [sx, 0.08, -1.4]));                          // pylon
    const bell = new THREE.Mesh(new THREE.CircleGeometry(0.28, 14), glowMat);
    bell.position.set(sx, 0.5, -2.52); bell.rotation.y = Math.PI; ship.add(bell);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.1, 14), plumeMat.clone());
    plume.rotation.x = -Math.PI / 2;        // taper points aft (-Z)
    plume.position.set(sx, 0.5, -3.05);
    ship.add(plume); plumes.push(plume);
  }
  // side outrigger arms + weapon pods + barrels
  for (const sx of [-1, 1]) {
    ship.add(part(new THREE.BoxGeometry(1.1, 0.16, 0.5), [sx * 0.74, -0.12, 0.3], null, [0, 0, sx * 0.1]));
    ship.add(part(new THREE.BoxGeometry(0.36, 0.4, 0.95), [sx * 1.3, -0.12, 0.2]));
    ship.add(part(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 8), [sx * 1.3, -0.12, 0.95], null, [Math.PI / 2, 0, 0]));
  }
  ship.scale.setScalar(0.82);
  ship.rotation.x = 0.34;
  scene.add(ship);

  camera.position.set(0, 1.0, 8.4); camera.lookAt(0, -0.05, -0.1);

  let raf = 0, active = false, start = performance.now();
  function frame(now) {
    ship.rotation.y = (now - start) / 3600 + 0.5;
    muzzle.material.opacity = 0.5 + 0.45 * Math.sin(now / 300);
    // engines always burn; boost (longer, hotter violet) while warping
    const warp = document.body.classList.contains('warp-hover');
    const flick = 0.85 + 0.15 * Math.sin(now / 55);
    for (const p of plumes) {
      const wide = warp ? 1.3 : 1;
      p.scale.set(wide, (warp ? 1.95 : 1.1) * flick, wide);
      p.material.opacity = (warp ? 0.82 : 0.5) * (0.85 + 0.15 * Math.sin(now / 48));
      p.material.color.setHex(warp ? 0xa898ff : 0x7fe0ff);
    }
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
