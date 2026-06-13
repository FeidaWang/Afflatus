/**
 * Three.js combat fighter (fig2 "Exscooter"-inspired interceptor): a central
 * cockpit pod with twin outrigger engine nacelles on swept arms, forward gun
 * barrels, glowing engine intakes and tail fins.
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
  const RES = 240;
  renderer.setSize(RES, RES, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2); camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x33465a, 1.5));
  const key = new THREE.DirectionalLight(0xdcecff, 2.6); key.position.set(5, 7, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6f9fff, 1.6); rim.position.set(-6, 1, -4); scene.add(rim);

  const hullMat = new THREE.MeshStandardMaterial({ color: 0x9aa7b4, metalness: 0.85, roughness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b333d, metalness: 0.9, roughness: 0.5 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x586571, metalness: 0.9, roughness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x14283c, metalness: 0.4, roughness: 0.08, emissive: 0x1a3450, emissiveIntensity: 0.8 });
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x9af0ff, emissive: 0x6fe0ff, emissiveIntensity: 2.4 });

  const fighter = new THREE.Group();
  const add = (geo, mat, t, s, r) => {
    const m = new THREE.Mesh(geo, mat);
    if (t) m.position.set(...t); if (s) m.scale.set(...s); if (r) m.rotation.set(...r);
    fighter.add(m); return m;
  };

  // central cockpit pod (nose +Z)
  add(new THREE.SphereGeometry(1, 22, 16), hullMat, [0, 0, -0.1], [0.46, 0.42, 1.25]);
  add(new THREE.ConeGeometry(0.32, 0.9, 18), hullMat, [0, 0, 1.25], null, [Math.PI / 2, 0, 0]);
  add(new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), glassMat, [0, 0.18, 0.35], [0.8, 0.7, 1.2]);
  // tail fins
  add(new THREE.BoxGeometry(0.06, 0.42, 0.5), trimMat, [0, 0.28, -1.0], null, [0.3, 0, 0]);
  add(new THREE.BoxGeometry(0.5, 0.06, 0.4), trimMat, [0, -0.18, -1.05], null, [-0.2, 0, 0]);

  // twin outrigger nacelles
  for (const sx of [-1, 1]) {
    // swept arm pod->nacelle
    add(new THREE.BoxGeometry(0.7, 0.16, 0.4), trimMat, [sx * 0.55, -0.02, -0.1], null, [0, 0, sx * 0.18]);
    // nacelle body
    add(new THREE.CylinderGeometry(0.26, 0.3, 1.9, 18), hullMat, [sx * 0.95, 0.02, 0.05], null, [Math.PI / 2, 0, 0]);
    // intake ring (front)
    add(new THREE.TorusGeometry(0.27, 0.05, 10, 18), darkMat, [sx * 0.95, 0.02, 0.95], null, [0, 0, 0]);
    // engine glow (rear)
    const glow = add(new THREE.CircleGeometry(0.22, 16), engineMat, [sx * 0.95, 0.02, -0.96], null, [0, Math.PI, 0]);
    const pl = new THREE.PointLight(0x6fe0ff, 4, 5); pl.position.set(sx * 0.95, 0.02, -1.3); fighter.add(pl);
    // forward gun barrel
    add(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 12), darkMat, [sx * 0.95, 0.02, 1.5], null, [Math.PI / 2, 0, 0]);
    glow.userData.pl = pl;
  }

  scene.add(fighter);
  fighter.rotation.order = 'YXZ';

  let ready = false;
  // renderer is ready immediately (no async textures)
  ready = true;

  function orient(az, el, now) {
    fighter.rotation.set(0, 0, 0);
    fighter.rotateX(-Math.PI / 2 + (el - 30) * DEG * 0.5);  // nose up; tip with elevation
    fighter.rotateY((az - 90) * DEG * 0.7);                 // bank / yaw with heading
    const flick = 2.2 + 0.4 * Math.sin(now / 70);
    engineMat.emissiveIntensity = flick;
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
