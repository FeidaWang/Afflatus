/**
 * Three.js "Enforcer" — long low-profile angular stealth capital warship.
 * Elongated wedge silhouette: sharp flat triangular bow, broad armoured
 * midsection with a raised command spine + amber command canopy, an off-centre
 * twin-rail bow turret ("01"), broad flat swept armoured wings, and a complex
 * multi-engine rear (rectangular engine pods + stabiliser fins + antenna mast).
 * Dark gunmetal / charcoal palette, layered plating, panel seams.
 *
 * Rendered offscreen into the pilot feed during the main-gun CHARGE phase
 * (camera dollies from the thrusters across the hull to the gun). Engine plasma
 * state follows the page: cruise orange · combat blue-green · warp violet.
 */
import * as THREE from 'three';
import { createOdinHull } from './odinHull.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2);

// Opt-in flag (ROADMAP §4 V15): default is the existing wedge-with-wings
// hull, byte-for-byte unchanged, unless this is present in the URL — the
// Odin-reference blade-hull rebuild has NOT been visually verified in a real
// browser (sandbox has no WebGL), so it stays preview-only until confirmed.
function odinHullEnabled() {
  try { return /[?&]ship=odin\b/.test(location.search); } catch (e) { return false; }
}

export function createCapitalShip3D() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault(), false); // recover, not black-screen

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1.6, 0.1, 200);
  scene.add(new THREE.AmbientLight(0x202832, 1.2));
  const key = new THREE.DirectionalLight(0xcfe0f0, 2.5); key.position.set(6, 10, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6a86c0, 1.5); rim.position.set(-7, 3, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffa86a, 0.5); fill.position.set(2, -4, 3); scene.add(fill);

  // ---- gunmetal / charcoal PBR materials ----
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x4a525c, metalness: 0.8, roughness: 0.55 });
  const armMat  = new THREE.MeshStandardMaterial({ color: 0x3a414a, metalness: 0.78, roughness: 0.62 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x21262d, metalness: 0.85, roughness: 0.58 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x6b7682, metalness: 0.9, roughness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x3a2410, metalness: 0.4, roughness: 0.18, emissive: 0xcc7a22, emissiveIntensity: 0.7 }); // amber canopy
  const redMat = new THREE.MeshStandardMaterial({ color: 0xff4030, emissive: 0xff2010, emissiveIntensity: 0.7 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x60c0ff, emissive: 0x3090ff, emissiveIntensity: 0.7 });
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x9fe0ff, emissive: 0x4fb8ff, emissiveIntensity: 2.3 });
  const plumeMat = new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });

  // procedural bump map → armour panel-line / rivet relief on the hull
  const bc = document.createElement('canvas'); bc.width = 512; bc.height = 512;
  const bx = bc.getContext('2d');
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, 512, 512);
  bx.strokeStyle = '#3a3a3a'; bx.lineWidth = 2.5;
  for (let i = 0; i < 16; i++) { const a = Math.random() * 512, b = Math.random() * 512; bx.beginPath(); bx.moveTo(a, 0); bx.lineTo(a, 512); bx.moveTo(0, b); bx.lineTo(512, b); bx.stroke(); }
  bx.lineWidth = 1.4;
  for (let i = 0; i < 46; i++) { bx.strokeStyle = Math.random() < 0.5 ? '#585858' : '#a2a2a2'; bx.strokeRect(Math.random() * 512, Math.random() * 512, 16 + Math.random() * 92, 16 + Math.random() * 92); }
  for (let i = 0; i < 170; i++) { bx.fillStyle = Math.random() < 0.5 ? '#9a9a9a' : '#565656'; bx.beginPath(); bx.arc(Math.random() * 512, Math.random() * 512, 1.6, 0, 7); bx.fill(); }
  const bumpTex = new THREE.CanvasTexture(bc); bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping; bumpTex.repeat.set(3, 3);
  for (const m of [hullMat, armMat, trimMat, darkMat]) { m.bumpMap = bumpTex; m.bumpScale = 0.014; }
  const gunMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x6fb4ff, emissiveIntensity: 0.5 });

  const ship = new THREE.Group();
  const M = (geo, mat, t, s, r) => { const m = new THREE.Mesh(geo, mat); if (t) m.position.set(t[0], t[1], t[2]); if (s) m.scale.set(s[0], s[1], s[2]); if (r) m.rotation.set(r[0], r[1], r[2]); ship.add(m); return m; };
  const useOdin = odinHullEnabled();
  let engines = [], muzzle, muzzleLight, odinInfo = null;

  if (useOdin) {
    // ===== Odin-reference blade hull (V15, preview-only via ?ship=odin) =====
    odinInfo = createOdinHull(THREE, {
      add: (geo, mat, t, r, s) => M(geo, mat, t, s, r), // odinHull.js signature is (t,r,s); M's is (t,s,r)
      mats: { hull: hullMat, arm: armMat, dark: darkMat, trim: trimMat, glass: glassMat, red: redMat, blue: blueMat },
      detail: 'full',
    });
    for (const em of odinInfo.engineMounts) {
      const grp = new THREE.Group();
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.4), darkMat); shield.position.set(0, 0.24, -0.2); grp.add(shield);
      const cavity = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.16), darkMat); cavity.position.z = -0.5; grp.add(cavity);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.24), engineMat); glow.position.z = -0.56; glow.rotation.y = Math.PI; grp.add(glow);
      const light = new THREE.PointLight(0x4fb8ff, 3.5, 5); light.position.z = -0.85; grp.add(light);
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.2, 2.3, 12), plumeMat.clone());
      plume.rotation.x = -Math.PI / 2; plume.position.z = -1.7; grp.add(plume);
      const halo = new THREE.Mesh(new THREE.ConeGeometry(0.38, 3.2, 12), plumeMat.clone()); halo.material.opacity = 0.16;
      halo.rotation.x = -Math.PI / 2; halo.position.z = -2.1; grp.add(halo);
      grp.position.set(em.x, em.y, em.z); grp.userData = { glow, light, plume, halo };
      ship.add(grp); engines.push(grp);
    }
    muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), gunMat);
    muzzle.position.set(odinInfo.muzzleAnchor.x, odinInfo.muzzleAnchor.y, odinInfo.muzzleAnchor.z); ship.add(muzzle);
    muzzleLight = new THREE.PointLight(0x7fb8ff, 0, 7);
    muzzleLight.position.set(odinInfo.muzzleAnchor.x, odinInfo.muzzleAnchor.y, odinInfo.muzzleAnchor.z + 0.3); ship.add(muzzleLight);
  } else {

  // ===== flat triangular wedge bow (nose +Z) =====
  M(new THREE.ConeGeometry(1.05, 3.4, 4), hullMat, [0, -0.02, 2.3], [1, 0.32, 1], [Math.PI / 2, 0, Math.PI / 4]); // wide flat faceted nose
  M(new THREE.BoxGeometry(1.5, 0.34, 1.6), armMat, [0, 0.04, 1.5]);                       // forward deck
  for (let i = 0; i < 4; i++) M(new THREE.BoxGeometry(1.4 - i * 0.18, 0.04, 0.16), trimMat, [0, 0.22, 2.2 - i * 0.45]); // bow panel seams
  // off-centre twin-rail bow turret + "01" plate
  // big forward-firing twin-barrel "01" turret
  M(new THREE.BoxGeometry(0.66, 0.22, 0.66), darkMat, [-0.3, 0.3, 1.15]);                 // turret base ring
  const turret = M(new THREE.BoxGeometry(0.56, 0.3, 0.5), trimMat, [-0.3, 0.46, 1.2]);    // gun house
  M(new THREE.BoxGeometry(0.3, 0.2, 0.36), darkMat, [-0.3, 0.46, 1.46]);                  // mantlet
  for (const bx of [-0.42, -0.18]) {
    M(new THREE.CylinderGeometry(0.05, 0.065, 1.6, 12), trimMat, [bx, 0.46, 2.15], null, [Math.PI / 2, 0, 0]); // twin barrels (forward)
    M(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 12), darkMat, [bx, 0.46, 2.9], null, [Math.PI / 2, 0, 0]);  // muzzle brake
  }
  M(new THREE.BoxGeometry(0.22, 0.16, 0.02), darkMat, [-0.05, 0.46, 1.2], null, [0, -0.5, 0]); // "01" decal plate (right side of house)

  // ===== broad armoured midsection + raised command spine =====
  M(new THREE.BoxGeometry(1.9, 0.5, 2.8), hullMat, [0, 0, -0.5]);
  M(new THREE.BoxGeometry(0.6, 0.5, 3.2), armMat, [0, 0.36, -0.4]);                       // command spine ridge
  for (let i = 0; i < 6; i++) M(new THREE.BoxGeometry(1.94, 0.04, 0.3), trimMat, [0, 0.27, -1.6 + i * 0.5]); // armour plate seams
  // amber command canopy (small, angular plating)
  M(new THREE.BoxGeometry(0.5, 0.16, 0.7), glassMat, [0, 0.62, 0.3]);
  M(new THREE.BoxGeometry(0.62, 0.1, 0.86), darkMat, [0, 0.54, 0.3]);                     // canopy frame
  // micro indicator lights
  for (const sx of [-1, 1]) { M(new THREE.SphereGeometry(0.03, 6, 5), sx < 0 ? redMat : blueMat, [sx * 0.85, 0.28, -0.2]); M(new THREE.SphereGeometry(0.025, 6, 5), blueMat, [sx * 0.7, 0.28, 0.8]); }

  // ===== broad flat swept armoured wings (heavy stabilisers) =====
  for (const sx of [-1, 1]) {
    M(new THREE.BoxGeometry(1.5, 0.14, 1.4), hullMat, [sx * 1.5, -0.05, -0.9], null, [0, sx * 0.18, sx * 0.06]);   // wing slab
    M(new THREE.BoxGeometry(1.4, 0.06, 0.4), armMat, [sx * 1.5, 0.06, -0.6], null, [0, sx * 0.18, 0]);             // overlapping plate
    M(new THREE.BoxGeometry(0.2, 0.16, 0.5), darkMat, [sx * 2.1, -0.02, -1.4], null, [0, sx * 0.18, 0]);          // wingtip hardpoint
    M(new THREE.CylinderGeometry(0.03, 0.04, 0.6, 8), trimMat, [sx * 2.1, -0.02, -1.05], null, [Math.PI / 2, 0, 0]); // hardpoint barrel
    M(new THREE.BoxGeometry(0.5, 0.1, 0.3), darkMat, [sx * 1.3, -0.14, -1.2]);                                    // underside protrusion
  }

  // ===== complex multi-engine rear + fins + antenna mast =====
  for (const [ex, ey] of [[-0.62, 0.12], [0.62, 0.12], [-0.62, -0.3], [0.62, -0.3], [0, 0.42]]) {
    const grp = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 1.0), trimMat); grp.add(housing);     // rectangular pod
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.4), darkMat); shield.position.set(0, 0.24, -0.2); grp.add(shield); // heat shield
    const cavity = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.16), darkMat); cavity.position.z = -0.5; grp.add(cavity);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.24), engineMat); glow.position.z = -0.56; glow.rotation.y = Math.PI; grp.add(glow);
    const light = new THREE.PointLight(0x4fb8ff, 3.5, 5); light.position.z = -0.85; grp.add(light);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.2, 2.3, 12), plumeMat.clone());
    plume.rotation.x = -Math.PI / 2; plume.position.z = -1.7; grp.add(plume);
    const halo = new THREE.Mesh(new THREE.ConeGeometry(0.38, 3.2, 12), plumeMat.clone()); halo.material.opacity = 0.16;
    halo.rotation.x = -Math.PI / 2; halo.position.z = -2.1; grp.add(halo);
    grp.position.set(ex, ey, -2.1); grp.userData = { glow, light, plume, halo };
    ship.add(grp); engines.push(grp);
  }
  // support struts
  for (const sx of [-1, 1]) M(new THREE.BoxGeometry(0.08, 0.08, 0.8), darkMat, [sx * 0.62, -0.1, -1.7]);
  // stabiliser fins (sharp stealth shapes)
  for (const sx of [-1, 1]) M(new THREE.BoxGeometry(0.06, 0.7, 0.7), armMat, [sx * 0.9, 0.3, -2.0], null, [0.2, 0, sx * 0.4]);
  M(new THREE.BoxGeometry(0.5, 0.5, 0.06), armMat, [0, 0.45, -2.4], null, [0.3, 0, 0]);   // vertical tail
  // raised multi-tiered command superstructure (mid-rear) — denser
  M(new THREE.BoxGeometry(0.84, 0.3, 1.5), armMat, [0, 0.55, -1.0]);
  M(new THREE.BoxGeometry(0.66, 0.26, 1.05), hullMat, [0, 0.79, -1.0]);
  M(new THREE.BoxGeometry(0.5, 0.2, 0.72), trimMat, [0, 0.99, -1.1]);
  M(new THREE.BoxGeometry(0.38, 0.14, 0.5), darkMat, [0, 1.14, -1.15]);
  for (let i = 0; i < 6; i++) M(new THREE.BoxGeometry(0.72, 0.03, 0.07), trimMat, [0, 0.71, -0.5 - i * 0.22]); // tier panel lines
  for (const sx of [-1, 1]) M(new THREE.BoxGeometry(0.06, 0.16, 0.42), darkMat, [sx * 0.43, 0.62, -1.0]);       // side housings
  M(new THREE.BoxGeometry(0.3, 0.06, 0.3), darkMat, [0, 1.22, -1.15]);                                          // sensor dish base
  // taller antenna mast + rods + tip light
  M(new THREE.CylinderGeometry(0.012, 0.02, 2.5, 6), trimMat, [0.1, 1.55, -1.35]);
  M(new THREE.SphereGeometry(0.032, 6, 5), redMat, [0.1, 2.8, -1.35]);
  M(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5), trimMat, [-0.18, 1.4, -1.4], null, [Math.PI / 3, 0, -0.3]);
  for (const sx of [-1, 1]) M(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 5), trimMat, [sx * 0.5, 0.1, -2.5], null, [Math.PI / 3, 0, sx * 0.3]);

  // ===== forward spinal main gun (fires through the bow channel) =====
  M(new THREE.CylinderGeometry(0.12, 0.16, 2.6, 14), trimMat, [0, -0.05, 2.0], null, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) M(new THREE.TorusGeometry(0.18, 0.04, 6, 16), darkMat, [0, -0.05, 1.2 + i * 0.5]);
  muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), gunMat); muzzle.position.set(0, -0.05, 3.5); ship.add(muzzle);
  muzzleLight = new THREE.PointLight(0x7fb8ff, 0, 7); muzzleLight.position.set(0, -0.05, 3.8); ship.add(muzzleLight);

  // ===== dense hard-surface detail: panel strips, recessed panels, bolts =====
  for (let i = 0; i < 46; i++) {
    const x = (Math.random() - 0.5) * 1.7, z = -1.8 + Math.random() * 4.0, r = Math.random();
    if (r < 0.55) M(new THREE.BoxGeometry(0.05 + Math.random() * 0.16, 0.02, 0.08 + Math.random() * 0.28), trimMat, [x, 0.24, z]);
    else if (r < 0.85) M(new THREE.BoxGeometry(0.1 + Math.random() * 0.18, 0.025, 0.1 + Math.random() * 0.18), darkMat, [x, 0.23, z]);
    else M(new THREE.BoxGeometry(0.04, 0.05, 0.04), trimMat, [x, 0.26, z]);
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) {
    const r = Math.random();
    M(new THREE.BoxGeometry(0.14 + r * 0.16, 0.02, 0.1 + r * 0.16), r < 0.5 ? trimMat : darkMat, [sx * (1.0 + Math.random() * 1.0), 0.04, -0.9 + (Math.random() - 0.5) * 1.1], null, [0, sx * 0.18, 0]);
  }
  // recessed bow strips
  for (let i = 0; i < 5; i++) M(new THREE.BoxGeometry(0.9 - i * 0.12, 0.02, 0.05), darkMat, [0, 0.05, 2.4 - i * 0.4]);

  // ===== CanvasTexture decals (hull markings + caution stripes) =====
  const mkTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const tx = new THREE.CanvasTexture(c); tx.anisotropy = 4; return tx; };
  const decal = (tex, p, s, r) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s[0], s[1]), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })); m.position.set(p[0], p[1], p[2]); m.rotation.set(r ? r[0] : -Math.PI / 2, r ? r[1] : 0, r ? r[2] : 0); m.renderOrder = 2; ship.add(m); return m; };
  const textTex = (txt, col, fs) => mkTex(256, 64, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = col || 'rgba(198,208,216,.94)'; x.font = `bold ${fs || 44}px Arial`; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText(txt, w / 2, h / 2 + 2); });
  const dangerTex = () => mkTex(256, 80, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    for (let i = -h; i < w; i += 16) { x.fillStyle = (Math.floor((i + h) / 16) % 2) ? '#f2c200' : '#111'; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 8, 0); x.lineTo(i + 8 + 22, 22); x.lineTo(i + 22, 22); x.closePath(); x.fill(); }
    x.fillStyle = 'rgba(10,10,10,.92)'; x.fillRect(0, 24, w, h - 24);
    x.fillStyle = '#ffb000'; x.font = 'bold 22px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('DANGER EJECTION PORT', w / 2, 52);
  });
  decal(textTex('TC CONDOR'), [0.45, 0.53, -0.5], [0.95, 0.22]);
  decal(textTex('310106'), [-0.4, 0.53, 0.5], [0.62, 0.18]);
  decal(textTex('01', 'rgba(214,222,230,.95)', 52), [-0.3, 0.625, 1.2], [0.26, 0.22]);
  decal(dangerTex(), [0.5, 0.53, -1.5], [0.62, 0.2]);
  decal(dangerTex(), [-0.5, 0.53, -1.5], [0.62, 0.2]);

  // denser recessed panel grooves (dorsal + wings)
  for (let i = 0; i < 18; i++) M(new THREE.BoxGeometry(0.02, 0.012, 0.3 + Math.random() * 0.4), darkMat, [(Math.random() - 0.5) * 1.6, 0.5, -1.6 + Math.random() * 3.6]);
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) M(new THREE.BoxGeometry(0.3, 0.008, 0.02), darkMat, [sx * (1.0 + Math.random() * 0.9), 0.025, -0.9 + (Math.random() - 0.5) * 1.0], null, [0, sx * 0.18, 0]);

  } // end else (default wedge hull)

  scene.add(ship);

  // starfield backdrop
  const starGeo = new THREE.BufferGeometry();
  const starN = 280, sp = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) { sp[i*3] = (Math.random()-0.5)*60; sp[i*3+1] = (Math.random()-0.5)*40; sp[i*3+2] = -10 - Math.random()*40; }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbfe0ff, size: 0.16, transparent: true, opacity: 0.8 })));

  let lastW = 0, lastH = 0;

  function draw(ctx, w, h, now, t01, lang) {
    const t = clamp(t01, 0, 1);
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    const rw = Math.max(2, Math.floor(w * dpr)), rh = Math.max(2, Math.floor(h * dpr));
    if (rw !== lastW || rh !== lastH) { renderer.setSize(rw, rh, false); camera.aspect = rw / rh; camera.updateProjectionMatrix(); lastW = rw; lastH = rh; }

    ship.rotation.y = 0.5 + Math.sin(now / 5200) * 0.04;
    ship.rotation.z = Math.sin(now / 6400) * 0.03;

    const cl = document.body.classList;
    const warp = cl.contains('warp-hover');
    const combat = t > 0.001 || cl.contains('combat-mode') || cl.contains('main-cannon-firing');
    const engHex = warp ? 0x8f7cff : (combat ? 0x8ff0ff : 0x4fb8ff);
    const pulse = 0.85 + 0.15 * Math.sin(now / 90);
    engineMat.color.setHex(engHex); engineMat.emissive.setHex(engHex); engineMat.emissiveIntensity = 2.2 * pulse;
    const plLen = (warp ? 1.85 : combat ? 1.4 : 1.1) * (0.9 + 0.1 * Math.sin(now / 50));
    for (const g of engines) {
      g.userData.light.color.setHex(engHex); g.userData.light.intensity = 4.5 * pulse;
      const pl = g.userData.plume; pl.material.color.setHex(engHex); pl.scale.set(1, plLen, 1);
      pl.material.opacity = (warp ? 0.82 : 0.6) * (0.85 + 0.15 * Math.sin(now / 45));
      const ha = g.userData.halo; ha.material.color.setHex(engHex); ha.scale.set(1, plLen * 1.06, 1);
      ha.material.opacity = (warp ? 0.26 : 0.16) * (0.85 + 0.15 * Math.sin(now / 60));
    }
    muzzle.material.emissiveIntensity = 0.5 + t * 3.6 * (0.7 + 0.3 * Math.sin(now / 60));
    muzzleLight.intensity = t * t * 10;

    // locked 3/4 top-front showcase angle; the ship drifts across the frame (fly-by)
    const e = easeInOut(t);
    if (useOdin) { camera.position.set(7.4, 7.0, 8.6); camera.lookAt(0, 0.1, -0.3); } // longer/taller hull → pull back proportionally
    else { camera.position.set(5.0, 5.3, 6.4); camera.lookAt(0, 0.1, -0.3); }
    ship.position.set(lerp(-2.0, 2.0, e), 0, lerp(1.0, -1.4, e));

    renderer.render(scene, camera);

    ctx.fillStyle = 'rgba(2,4,8,.96)'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(renderer.domElement, 0, 0, w, h);

    const bar = Math.max(10, h * .075);
    ctx.fillStyle = 'rgba(0,0,0,.82)'; ctx.fillRect(0, 0, w, bar); ctx.fillRect(0, h - bar, w, bar);
    ctx.fillStyle = 'rgba(255,235,235,.9)';
    ctx.font = `${Math.max(7, Math.min(w, h) * .046)}px 'JetBrains Mono',monospace`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(lang === 'zh' ? '执法者号 · 粒子脊柱充能' : 'CONDOR · PARTICLE SPINE CHARGING', 10, bar * .5);
    ctx.textAlign = 'right';
    ctx.fillStyle = `rgba(255,90,100,${.6 + .4 * Math.sin(now / 140)})`;
    ctx.fillText(`${Math.round(t * 100)}%`, w - 10, bar * .5);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(10, h - bar * .5, w - 20, 2);
    const pg = ctx.createLinearGradient(10, 0, w - 10, 0);
    pg.addColorStop(0, 'rgba(154,229,255,.9)'); pg.addColorStop(1, 'rgba(255,90,100,.95)');
    ctx.fillStyle = pg; ctx.fillRect(10, h - bar * .5, (w - 20) * t, 2);
  }

  return { draw, ready: () => true };
}
