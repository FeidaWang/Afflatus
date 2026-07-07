/**
 * Three.js holographic projection of the login-screen ship. Default hull is
 * "Wraith" (carrierHull.js, 2026-07-08): a hand-built approximation of the
 * user's reference wireframe image (assets/hud/ship-hologram.jpeg) — wide
 * flat hull, forked twin-blade bow, stepped tower + spire, swept wings. The
 * previous wedge/stealth "Enforcer" hull (flat triangular bow, amber canopy,
 * multi-engine rear) is still available via ?ship=wedge for comparison/
 * rollback. ?ship=odin keeps the earlier reference-rebuild blade hull.
 * Translucent cyan fills + bright wireframe edges with always-on engine
 * plumes; engines/beam follow the page state (cruise / combat / warp /
 * main-gun firing) regardless of which hull is active.
 *
 * Fixed-size render buffer scaled by CSS so it never blanks on a 0-width canvas.
 */
import * as THREE from 'three';
import { createOdinHull } from './odinHull.js';
import { createCarrierHull } from './carrierHull.js';

// ?ship=odin / ?ship=wedge opt out of the new default "Wraith" carrier hull
// (see file header). Same query-param convention as capitalShip3D.js's
// pre-existing ?ship=odin gate.
function shipVariant() {
  try {
    const m = /[?&]ship=(odin|wedge)\b/.exec(location.search);
    return m ? m[1] : 'carrier';
  } catch (e) { return 'carrier'; }
}

export function createShipHologram(canvas) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
  catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault(), false); // recover, not black-screen
  renderer.setSize(240, 300, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 240 / 300, 0.1, 100);
  scene.add(new THREE.AmbientLight(0x335577, 2));
  const key = new THREE.DirectionalLight(0x9fe6ff, 1.3); key.position.set(4, 6, 5); scene.add(key);

  const fillMat = new THREE.MeshBasicMaterial({ color: 0x3aa8e0, transparent: true, opacity: 0.12 });
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xcc7a22, transparent: true, opacity: 0.32 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x9af0ff, transparent: true, opacity: 0.85 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xcdf6ff, transparent: true, opacity: 0.95 });

  const ship = new THREE.Group();
  const part = (geo, t, s, r, mat) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat || fillMat));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    if (t) g.position.set(t[0], t[1], t[2]);
    if (s) g.scale.set(s[0], s[1], s[2]);
    if (r) g.rotation.set(r[0], r[1], r[2]);
    ship.add(g); return g;
  };

  const beamMat = new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const plumeMat = new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const variant = shipVariant();
  let muzzle, beam, plumes = [];

  // Shared attach logic for the two "loft hull" variants (odin, carrier) —
  // both expose the same { muzzleAnchor, engineMounts } shape from their
  // createXHull() info object.
  function attachMuzzleBeamPlumes(info) {
    muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 9), glowMat.clone());
    muzzle.position.set(info.muzzleAnchor.x, info.muzzleAnchor.y, info.muzzleAnchor.z); ship.add(muzzle);
    beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.13, 3.4, 10), beamMat);
    beam.rotation.x = Math.PI / 2; beam.position.set(info.muzzleAnchor.x, info.muzzleAnchor.y, info.muzzleAnchor.z + 1.7); beam.visible = false; ship.add(beam);
    for (const em of info.engineMounts) {
      const bell = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.24), glowMat);
      bell.position.set(em.x, em.y, em.z - 0.56); bell.rotation.y = Math.PI; ship.add(bell);
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.85, 10), plumeMat.clone());
      plume.rotation.x = -Math.PI / 2; plume.position.set(em.x, em.y, em.z - 1.0);
      ship.add(plume); plumes.push(plume);
    }
  }

  if (variant === 'odin') {
    // ===== Odin-reference blade hull (V15, preview-only via ?ship=odin) =====
    // 'wire' detail skips the fine greeble scatter — the hologram is meant to
    // read as a clean silhouette, matching how this file already only ever
    // built a sparse subset of capitalShip3D.js's full detail.
    const info = createOdinHull(THREE, {
      add: (geo, mat, t, r, s) => part(geo, t, s, r, mat), // odinHull.js signature is (t,r,s); part()'s is (t,s,r,mat)
      mats: { hull: fillMat, arm: fillMat, dark: fillMat, trim: fillMat, glass: amberMat, red: glowMat, blue: glowMat },
      detail: 'wire',
    });
    attachMuzzleBeamPlumes(info);
  } else if (variant === 'carrier') {
    // ===== "Wraith" carrier hull (default, 2026-07-08) — approximation of =====
    // the reference wireframe image, see carrierHull.js header for scope notes.
    const info = createCarrierHull(THREE, {
      add: (geo, mat, t, r, s) => part(geo, t, s, r, mat), // carrierHull.js signature is (t,r,s); part()'s is (t,s,r,mat)
      mats: { hull: fillMat, arm: fillMat, dark: fillMat, trim: fillMat, glass: amberMat, red: glowMat, blue: glowMat },
      detail: 'wire',
    });
    attachMuzzleBeamPlumes(info);
  } else {

  // ===== legacy wedge/stealth "Enforcer" hull (?ship=wedge) =====
  // flat triangular wedge bow
  part(new THREE.ConeGeometry(1.05, 3.4, 4), [0, -0.02, 2.3], [1, 0.32, 1], [Math.PI / 2, 0, Math.PI / 4]);
  part(new THREE.BoxGeometry(1.5, 0.34, 1.6), [0, 0.04, 1.5]);
  // off-centre "01" twin-rail turret
  part(new THREE.BoxGeometry(0.42, 0.2, 0.42), [-0.34, 0.26, 1.1]);
  for (const bx of [-0.46, -0.22]) part(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), [bx, 0.3, 1.55], null, [Math.PI / 2, 0, 0]);

  // broad midsection + command spine + amber canopy
  part(new THREE.BoxGeometry(1.9, 0.5, 2.8), [0, 0, -0.5]);
  part(new THREE.BoxGeometry(0.6, 0.5, 3.2), [0, 0.36, -0.4]);
  part(new THREE.BoxGeometry(0.5, 0.16, 0.7), [0, 0.62, 0.3], null, null, amberMat);

  // broad swept armoured wings
  for (const sx of [-1, 1]) {
    part(new THREE.BoxGeometry(1.5, 0.14, 1.4), [sx * 1.5, -0.05, -0.9], null, [0, sx * 0.18, sx * 0.06]);
    part(new THREE.BoxGeometry(0.2, 0.16, 0.5), [sx * 2.1, -0.02, -1.4], null, [0, sx * 0.18, 0]);
  }

  // spinal main gun + muzzle + beam
  part(new THREE.CylinderGeometry(0.12, 0.16, 2.6, 12), [0, -0.05, 2.0], null, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) part(new THREE.TorusGeometry(0.18, 0.04, 6, 14), [0, -0.05, 1.2 + i * 0.5]);
  muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 9), glowMat.clone());
  muzzle.position.set(0, -0.05, 3.5); ship.add(muzzle);
  beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.13, 3.4, 10), beamMat);
  beam.rotation.x = Math.PI / 2; beam.position.set(0, -0.05, 5.0); beam.visible = false; ship.add(beam);

  // multi-engine rear (rectangular pods) + plumes, fins, antenna mast
  for (const [ex, ey] of [[-0.62, 0.12], [0.62, 0.12], [-0.62, -0.3], [0.62, -0.3], [0, 0.42]]) {
    part(new THREE.BoxGeometry(0.5, 0.42, 1.0), [ex, ey, -2.1]);
    const bell = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.24), glowMat);
    bell.position.set(ex, ey, -2.66); bell.rotation.y = Math.PI; ship.add(bell);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.85, 10), plumeMat.clone());
    plume.rotation.x = -Math.PI / 2; plume.position.set(ex, ey, -3.1);
    ship.add(plume); plumes.push(plume);
  }
  for (const sx of [-1, 1]) part(new THREE.BoxGeometry(0.06, 0.7, 0.7), [sx * 0.9, 0.3, -2.0], null, [0.2, 0, sx * 0.4]);
  part(new THREE.CylinderGeometry(0.015, 0.02, 1.2, 6), [0.15, 0.9, -1.9]);   // antenna mast

  } // end else (?ship=wedge legacy hull)

  ship.scale.setScalar(0.6);
  ship.rotation.x = 0.36;
  scene.add(ship);

  camera.position.set(0, 1.2, 9.0); camera.lookAt(0, -0.05, -0.2);

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
    if (firing) { beamMat.opacity = 0.7 + 0.3 * Math.sin(now / 38); beam.scale.x = beam.scale.z = 1 + 0.35 * Math.sin(now / 26); muzzle.material.opacity = 1; }
    else muzzle.material.opacity = 0.5 + 0.45 * Math.sin(now / 300);
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
