/**
 * Three.js holographic projection of the "Enforcer" mothership — same twin-
 * pronged design as the full PBR model (capitalShip3D): two armoured spear bows
 * with a central weapons channel, a spinal coherent-beam cannon with focusing
 * rings, a dense fuselage + bridge, midship fuel tanks, and four aft fusion
 * engines. Rendered as translucent cyan fills + bright wireframe edges with
 * always-on engine plumes; engines/beam follow the page state (cruise / combat /
 * warp / main-gun firing).
 *
 * Fixed-size render buffer scaled by CSS so it never blanks on a 0-width canvas.
 */
import * as THREE from 'three';

export function createShipHologram(canvas) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
  catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  const RW = 240, RH = 300;
  renderer.setSize(RW, RH, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, RW / RH, 0.1, 100);
  scene.add(new THREE.AmbientLight(0x335577, 2));
  const key = new THREE.DirectionalLight(0x9fe6ff, 1.4); key.position.set(4, 6, 5); scene.add(key);

  const fillMat = new THREE.MeshBasicMaterial({ color: 0x3aa8e0, transparent: true, opacity: 0.13 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x9af0ff, transparent: true, opacity: 0.88 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xcdf6ff, transparent: true, opacity: 0.95 });

  // translucent fill + wireframe edges, positioned/scaled/rotated
  const part = (geo, t, s, r) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, fillMat));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    if (t) g.position.set(t[0], t[1], t[2]);
    if (s) g.scale.set(s[0], s[1], s[2]);
    if (r) g.rotation.set(r[0], r[1], r[2]);
    ship.add(g); return g;
  };

  const ship = new THREE.Group();

  // central fuselage core
  part(new THREE.BoxGeometry(1.1, 0.9, 3.6), [0, 0, -0.2]);
  part(new THREE.BoxGeometry(1.3, 0.42, 2.9), [0, 0.26, -0.3]);   // dorsal deck

  // twin-pronged forward bows + central channel
  for (const sx of [-1, 1]) {
    part(new THREE.BoxGeometry(0.42, 0.5, 2.6), [sx * 0.62, 0, 2.0]);
    part(new THREE.ConeGeometry(0.27, 1.2, 4), [sx * 0.62, 0, 3.65], null, [Math.PI / 2, 0, Math.PI / 4]);
  }

  // spinal beam cannon + focusing rings
  part(new THREE.CylinderGeometry(0.17, 0.22, 4.8, 12), [0, 0.02, 1.4], null, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 5; i++) part(new THREE.TorusGeometry(0.27, 0.05, 6, 16), [0, 0.02, 1.0 + i * 0.62]);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 9), glowMat.clone());
  muzzle.position.set(0, 0.02, 4.05); ship.add(muzzle);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.13, 3.4, 10), beamMat);
  beam.rotation.x = Math.PI / 2; beam.position.set(0, 0.02, 5.4); beam.visible = false; ship.add(beam);

  // bridge + midship fuel tanks
  part(new THREE.BoxGeometry(0.6, 0.4, 0.9), [0, 0.58, -0.7]);
  for (const sx of [-1, 1]) part(new THREE.CylinderGeometry(0.17, 0.17, 1.5, 10), [sx * 0.8, -0.12, -0.4], null, [Math.PI / 2, 0, 0]);

  // four aft fusion engines + live plumes
  const plumeMat = new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const plumes = [];
  for (const [ex, ey] of [[-0.56, 0.2], [0.56, 0.2], [-0.56, -0.34], [0.56, -0.34]]) {
    part(new THREE.CylinderGeometry(0.27, 0.33, 1.0, 12), [ex, ey, -1.95], null, [Math.PI / 2, 0, 0]);
    const bell = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), glowMat);
    bell.position.set(ex, ey, -2.6); bell.rotation.y = Math.PI; ship.add(bell);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 12), plumeMat.clone());
    plume.rotation.x = -Math.PI / 2; plume.position.set(ex, ey, -3.05);
    ship.add(plume); plumes.push(plume);
  }
  // rear manipulator arms
  for (const sx of [-1, 1]) part(new THREE.BoxGeometry(0.1, 0.1, 0.75), [sx * 0.5, 0.12, -2.4], null, [0.32, 0, 0]);

  ship.scale.setScalar(0.72);
  ship.rotation.x = 0.34;
  scene.add(ship);

  camera.position.set(0, 1.0, 9.2); camera.lookAt(0, -0.05, -0.1);

  let raf = 0, active = false, start = performance.now();
  function frame(now) {
    ship.rotation.y = (now - start) / 3800 + 0.5;
    const cl = document.body.classList;
    const warp = cl.contains('warp-hover'), combat = cl.contains('combat-mode'), firing = cl.contains('main-cannon-firing');
    let col = 0x7fe0ff, len = 1.1, op = 0.5, wide = 1;
    if (combat) { col = 0x6effbf; len = 1.5; op = 0.66; }
    if (warp) { col = 0xa898ff; len = 1.95; op = 0.82; wide = 1.3; }
    const flick = 0.85 + 0.15 * Math.sin(now / 55);
    for (const p of plumes) {
      p.scale.set(wide, len * flick, wide);
      p.material.opacity = op * (0.85 + 0.15 * Math.sin(now / 48));
      p.material.color.setHex(col);
    }
    beam.visible = firing;
    if (firing) {
      beamMat.opacity = 0.7 + 0.3 * Math.sin(now / 38);
      beam.scale.x = beam.scale.z = 1 + 0.35 * Math.sin(now / 26);
      muzzle.material.opacity = 1;
    } else {
      muzzle.material.opacity = 0.5 + 0.45 * Math.sin(now / 300);
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
