/**
 * Three.js combat fighter — high-poly "F47" 6th-gen interceptor: a chiseled
 * central fuselage with a blended delta wing, forward canards, twin canted
 * tail fins, a faceted bubble canopy, leading-edge root extensions, twin
 * afterburning nacelles with glowing intakes + exhaust cones, and chin gun
 * barrels.
 *
 * Drop-in for spriteCraft: exposes drawOriented(ctx, type, {az, el, size, alpha})
 * with the same convention (nose up in frame; az/el = view angle). It renders
 * the 3D model offscreen for the requested orientation and drawImage-s it,
 * centred, into the 2D event-layer. Only 'f47' is 3D; 'b2' returns false so the
 * bomber keeps its sprite.
 */
import * as THREE from 'three';

const DEG = Math.PI / 180;

export function createFighter3D() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  const RES = 320;
  renderer.setSize(RES, RES, false);
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2); camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x33465a, 1.5));
  const key = new THREE.DirectionalLight(0xdcecff, 2.6); key.position.set(5, 7, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6f9fff, 1.6); rim.position.set(-6, 1, -4); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xa9c4ff, 0.8); fill.position.set(0, -5, 3); scene.add(fill);

  const hullMat   = new THREE.MeshStandardMaterial({ color: 0x9aa7b4, metalness: 0.85, roughness: 0.4 });
  const hullLoMat = new THREE.MeshStandardMaterial({ color: 0x7c8893, metalness: 0.88, roughness: 0.45 });
  const darkMat   = new THREE.MeshStandardMaterial({ color: 0x2b333d, metalness: 0.9, roughness: 0.5 });
  const trimMat   = new THREE.MeshStandardMaterial({ color: 0x586571, metalness: 0.9, roughness: 0.35 });
  const glassMat  = new THREE.MeshStandardMaterial({ color: 0x14283c, metalness: 0.4, roughness: 0.08, emissive: 0x1a3450, emissiveIntensity: 0.8 });
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x9af0ff, emissive: 0x6fe0ff, emissiveIntensity: 2.4 });
  const burnMat   = new THREE.MeshStandardMaterial({ color: 0xffcaa0, emissive: 0xff7a32, emissiveIntensity: 2.0, transparent: true, opacity: 0.85 });

  const fighter = new THREE.Group();
  const add = (geo, mat, t, s, r, parent) => {
    const m = new THREE.Mesh(geo, mat);
    if (t) m.position.set(...t); if (s) m.scale.set(...s); if (r) m.rotation.set(...r);
    (parent || fighter).add(m); return m;
  };

  // ---- central fuselage (nose +Z) -----------------------------------------
  add(new THREE.SphereGeometry(1, 32, 24), hullMat, [0, 0, -0.1], [0.46, 0.42, 1.32]);
  // chiseled nose: octagonal cone for a faceted radome
  add(new THREE.ConeGeometry(0.34, 1.05, 8), hullMat, [0, -0.01, 1.3], null, [Math.PI / 2, 0, Math.PI / 8]);
  // dorsal spine
  add(new THREE.BoxGeometry(0.22, 0.16, 1.5), hullLoMat, [0, 0.2, -0.1], null, [0.04, 0, 0]);
  // faceted bubble canopy + frame
  add(new THREE.SphereGeometry(0.36, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), glassMat, [0, 0.2, 0.4], [0.82, 0.74, 1.3]);
  add(new THREE.TorusGeometry(0.27, 0.025, 8, 24), trimMat, [0, 0.18, 0.4], [1, 0.7, 1.25], [Math.PI / 2.2, 0, 0]);

  // ---- blended delta main wing --------------------------------------------
  for (const sx of [-1, 1]) {
    const wing = new THREE.Shape();
    wing.moveTo(0, 0.55);          // root leading
    wing.lineTo(1.55, -0.55);      // tip
    wing.lineTo(1.5, -0.78);       // tip trailing
    wing.lineTo(0.1, -0.95);       // root trailing
    wing.closePath();
    const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    const w = add(wg, hullMat, [sx * 0.32, -0.06, -0.1], [sx, 1, 1], [Math.PI / 2, 0, 0]);
    w.rotation.x = Math.PI / 2; // lay flat in XZ
    // leading-edge root extension (LERX)
    const lerx = new THREE.Shape();
    lerx.moveTo(0, 0.7); lerx.lineTo(0.5, 0.1); lerx.lineTo(0.05, -0.1); lerx.closePath();
    const lg = new THREE.ExtrudeGeometry(lerx, { depth: 0.05, bevelEnabled: false });
    const l = add(lg, trimMat, [sx * 0.28, -0.04, 0.55], [sx, 1, 1], [Math.PI / 2, 0, 0]);
    l.rotation.x = Math.PI / 2;
    // wingtip rail / missile
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 10), darkMat, [sx * 1.78, -0.04, -0.62], null, [Math.PI / 2, 0, 0]);
  }

  // ---- forward canards -----------------------------------------------------
  for (const sx of [-1, 1]) {
    const can = new THREE.Shape();
    can.moveTo(0, 0.18); can.lineTo(0.62, -0.06); can.lineTo(0.58, -0.2); can.lineTo(0.05, -0.22); can.closePath();
    const cg = new THREE.ExtrudeGeometry(can, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    const c = add(cg, trimMat, [sx * 0.3, 0.0, 0.92], [sx, 1, 1], [Math.PI / 2, 0, 0]);
    c.rotation.x = Math.PI / 2;
  }

  // ---- twin canted vertical tails -----------------------------------------
  for (const sx of [-1, 1]) {
    const fin = new THREE.Shape();
    fin.moveTo(0, 0); fin.lineTo(0.05, 0.5); fin.lineTo(0.34, 0.5); fin.lineTo(0.46, 0); fin.closePath();
    const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    add(fg, trimMat, [sx * 0.42, 0.12, -1.0], null, [0, 0, sx * 0.42]);
  }
  // ventral stabilizer
  add(new THREE.BoxGeometry(0.5, 0.05, 0.34), trimMat, [0, -0.2, -1.08], null, [-0.2, 0, 0]);

  // ---- twin afterburning nacelles -----------------------------------------
  const glows = [];
  for (const sx of [-1, 1]) {
    // swept arm pod->nacelle
    add(new THREE.BoxGeometry(0.7, 0.16, 0.5), trimMat, [sx * 0.55, -0.04, -0.15], null, [0, 0, sx * 0.16]);
    // nacelle body (more segments)
    add(new THREE.CylinderGeometry(0.27, 0.31, 2.0, 28), hullMat, [sx * 0.96, 0.0, 0.0], null, [Math.PI / 2, 0, 0]);
    // paneling band
    add(new THREE.CylinderGeometry(0.315, 0.315, 0.18, 28), hullLoMat, [sx * 0.96, 0.0, -0.2], null, [Math.PI / 2, 0, 0]);
    // intake lip (front)
    add(new THREE.TorusGeometry(0.28, 0.055, 14, 28), darkMat, [sx * 0.96, 0.0, 0.98], null, [0, 0, 0]);
    add(new THREE.CircleGeometry(0.24, 24), darkMat, [sx * 0.96, 0.0, 0.97]);
    // exhaust nozzle ring + petals
    add(new THREE.CylinderGeometry(0.24, 0.2, 0.3, 24), darkMat, [sx * 0.96, 0.0, -1.05], null, [Math.PI / 2, 0, 0]);
    // engine glow (rear)
    const glow = add(new THREE.CircleGeometry(0.2, 24), engineMat, [sx * 0.96, 0.0, -1.18], null, [0, Math.PI, 0]);
    // afterburner cone
    const burn = add(new THREE.ConeGeometry(0.17, 0.9, 18), burnMat, [sx * 0.96, 0.0, -1.6], null, [-Math.PI / 2, 0, 0]);
    const pl = new THREE.PointLight(0x6fe0ff, 4, 5); pl.position.set(sx * 0.96, 0.0, -1.4); fighter.add(pl);
    // forward chin gun barrel
    add(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 14), darkMat, [sx * 0.96, -0.02, 1.55], null, [Math.PI / 2, 0, 0]);
    glow.userData.pl = pl; glow.userData.burn = burn; glows.push(glow);
  }

  scene.add(fighter);
  fighter.rotation.order = 'YXZ';

  let ready = true;   // no async textures

  function orient(az, el, now) {
    fighter.rotation.set(0, 0, 0);
    fighter.rotateX(-Math.PI / 2 + (el - 30) * DEG * 0.5);  // nose up; tip with elevation
    fighter.rotateY((az - 90) * DEG * 0.7);                 // bank / yaw with heading
    const flick = 2.2 + 0.4 * Math.sin(now / 70);
    engineMat.emissiveIntensity = flick;
    const bflick = 1.7 + 0.5 * Math.sin(now / 45 + 1.3);
    burnMat.emissiveIntensity = bflick;
    burnMat.opacity = 0.7 + 0.2 * Math.sin(now / 60);
  }

  function drawOriented(ctx, type, { az = 90, el = 45, size = 96, alpha = 1 } = {}) {
    if (type === 'b2' || !ready) return false;   // bomber keeps its sprite
    orient(az, el, performance.now());
    renderer.render(scene, camera);
    const draw = size * 1.5;   // model framed to ~2/3 of the render → craft length ~= size
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * alpha;
    ctx.drawImage(renderer.domElement, -draw / 2, -draw / 2, draw, draw);
    ctx.globalAlpha = a;
    return true;
  }

  return { drawOriented, available: () => ready };
}
