/**
 * Three.js "Enforcer" — a heavily armed deep-space interceptor battleship
 * (late-industrial hard sci-fi). Wide twin-pronged forward hull (two armoured
 * spear bows separated by a central weapons channel), a super-heavy spinal
 * coherent-beam cannon running through the core with magnetic focusing rings +
 * capacitor banks, a dense armoured fuselage (reactor/command/bridge), midship
 * fuel tanks, radiator fins, missile cells, point-defense turrets and greebles,
 * rear manipulator arms, and four aft fusion engines with multi-state plasma:
 *   cruise = orange-yellow · combat = blue-green · warp = blue-violet/cyan.
 *
 * Rendered offscreen and drawImage-d into the pilot feed during the main-gun
 * CHARGE phase (camera dollies from the thrusters across the hull to the gun).
 */
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2);

export function createCapitalShip3D() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1.6, 0.1, 200);

  scene.add(new THREE.AmbientLight(0x26323f, 1.3));
  const key = new THREE.DirectionalLight(0xcfe8ff, 2.5); key.position.set(6, 9, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0x5f8fff, 1.7); rim.position.set(-7, 2, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffa86a, 0.55); fill.position.set(2, -4, 3); scene.add(fill);

  // ---- PBR materials (titanium hull, dark metal, trim, glass, emissives) ----
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x8e9ba9, metalness: 0.86, roughness: 0.44 });
  const armMat  = new THREE.MeshStandardMaterial({ color: 0x76838f, metalness: 0.82, roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x29313b, metalness: 0.9, roughness: 0.52 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x55636f, metalness: 0.92, roughness: 0.34 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x14283c, metalness: 0.3, roughness: 0.1, emissive: 0x183048, emissiveIntensity: 0.8 });
  const engineMat = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xffa030, emissiveIntensity: 2.0 });
  const gunMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x6fb4ff, emissiveIntensity: 0.5 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x3a8fb0, metalness: 0.6, roughness: 0.4, emissive: 0x1d6f9a, emissiveIntensity: 0.5 });
  const radMat = new THREE.MeshStandardMaterial({ color: 0x6a3b2c, metalness: 0.5, roughness: 0.6, emissive: 0xff5a2a, emissiveIntensity: 0.35 });

  const ship = new THREE.Group();
  const M = (geo, mat, t, s, r) => { const m = new THREE.Mesh(geo, mat); if (t) m.position.set(t[0], t[1], t[2]); if (s) m.scale.set(s[0], s[1], s[2]); if (r) m.rotation.set(r[0], r[1], r[2]); ship.add(m); return m; };

  // ===== central armoured fuselage (reactor + cannon core) =====
  M(new THREE.BoxGeometry(1.12, 0.92, 3.6), hullMat, [0, 0, -0.2]);
  M(new THREE.BoxGeometry(1.34, 0.46, 2.9), armMat, [0, 0.26, -0.3]);          // dorsal armour deck
  M(new THREE.BoxGeometry(1.2, 0.42, 2.7), darkMat, [0, -0.46, -0.3]);          // ventral keel
  for (let i = 0; i < 6; i++) M(new THREE.BoxGeometry(1.36, 0.05, 0.32), trimMat, [0, 0.5, -1.5 + i * 0.52]); // armour plate seams

  // ===== twin-pronged forward bows (spear hulls + central weapons channel) ====
  const prong = (sx) => {
    M(new THREE.BoxGeometry(0.42, 0.5, 2.6), hullMat, [sx * 0.62, 0, 2.0]);
    M(new THREE.ConeGeometry(0.27, 1.2, 4), hullMat, [sx * 0.62, 0, 3.65], null, [Math.PI / 2, 0, Math.PI / 4]); // faceted spear tip
    M(new THREE.BoxGeometry(0.46, 0.12, 1.9), armMat, [sx * 0.62, 0.28, 2.1]);   // dorsal rib
    M(new THREE.BoxGeometry(0.46, 0.12, 1.9), darkMat, [sx * 0.62, -0.26, 2.1]); // ventral rib
    for (let i = 0; i < 4; i++) M(new THREE.BoxGeometry(0.44, 0.04, 0.2), trimMat, [sx * 0.62, 0.31, 1.4 + i * 0.5]); // panel lines
    M(new THREE.BoxGeometry(0.18, 0.18, 0.5), darkMat, [sx * 0.78, 0, 1.0]);     // missile cell on prong root
  };
  prong(-1); prong(1);

  // ===== spinal coherent-beam cannon (through the central channel) =====
  const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 4.8, 18), trimMat);
  cannon.rotation.x = Math.PI / 2; cannon.position.set(0, 0.02, 1.4); ship.add(cannon);
  for (let i = 0; i < 6; i++) M(new THREE.TorusGeometry(0.27, 0.05, 8, 22), darkMat, [0, 0.02, 0.9 + i * 0.56]); // magnetic focusing rings
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) M(new THREE.BoxGeometry(0.13, 0.34, 0.46), capMat, [sx * 0.36, 0.02, -0.1 + i * 0.52]); // capacitor banks
  for (const sx of [-1, 1]) M(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), darkMat, [sx * 0.3, 0.34, 0.6], null, [Math.PI / 2, 0, 0]); // power conduits
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), gunMat); muzzle.position.set(0, 0.02, 4.05); ship.add(muzzle);
  const muzzleLight = new THREE.PointLight(0x7fb8ff, 0, 7); muzzleLight.position.set(0, 0.02, 4.35); ship.add(muzzleLight);

  // ===== command bridge + sensors =====
  M(new THREE.BoxGeometry(0.62, 0.42, 0.9), hullMat, [0, 0.58, -0.7]);
  M(new THREE.BoxGeometry(0.5, 0.16, 0.5), glassMat, [0, 0.78, -0.5]);
  M(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 6), trimMat, [0, 1.05, -0.85]);
  M(new THREE.SphereGeometry(0.04, 8, 6), gunMat, [0, 1.4, -0.85]);
  for (const sx of [-1, 1]) M(new THREE.BoxGeometry(0.05, 0.22, 0.05), trimMat, [sx * 0.5, 0.7, -1.4], null, [0.3, 0, sx * 0.2]); // sensor antennae

  // ===== midship: fuel tanks, radiators, missile cells, point-defense =====
  for (const sx of [-1, 1]) {
    M(new THREE.CylinderGeometry(0.17, 0.17, 1.5, 14), darkMat, [sx * 0.8, -0.12, -0.4], null, [Math.PI / 2, 0, 0]); // external fuel tank
    M(new THREE.SphereGeometry(0.17, 10, 8), darkMat, [sx * 0.8, -0.12, 0.35]);
    M(new THREE.SphereGeometry(0.17, 10, 8), darkMat, [sx * 0.8, -0.12, -1.15]);
    for (let i = 0; i < 3; i++) M(new THREE.BoxGeometry(0.02, 0.42, 0.62), radMat, [sx * (0.72 + i * 0.07), 0.46, -1.05]); // radiator fins
    M(new THREE.BoxGeometry(0.3, 0.16, 0.6), trimMat, [sx * 0.5, 0.34, -1.5]);  // missile-cell block
    const turret = M(new THREE.CylinderGeometry(0.09, 0.12, 0.1, 10), darkMat, [sx * 0.42, 0.42, 0.5]);
    M(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), trimMat, [sx * 0.42, 0.5, 0.62], null, [Math.PI / 2.3, 0, 0]); // PD barrel
  }
  for (let i = 0; i < 26; i++) M(new THREE.BoxGeometry(0.1 + Math.random() * 0.2, 0.05 + Math.random() * 0.08, 0.1 + Math.random() * 0.3), i % 2 ? darkMat : trimMat, [(Math.random() - 0.5) * 1.4, 0.12 + Math.random() * 0.42, (Math.random() - 0.5) * 3.4]); // greebles

  // ===== aft: four fusion engines + manipulator arms =====
  const engines = [];
  for (const [ex, ey] of [[-0.56, 0.2], [0.56, 0.2], [-0.56, -0.34], [0.56, -0.34]]) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.33, 1.0, 16), trimMat); body.rotation.x = Math.PI / 2; grp.add(body);
    for (let i = 0; i < 2; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.04, 8, 16), darkMat); rib.position.z = -0.2 + i * 0.4; grp.add(rib); }
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.22, 0.34, 16), darkMat); bell.rotation.x = Math.PI / 2; bell.position.z = -0.66; grp.add(bell);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), engineMat); glow.position.z = -0.83; glow.rotation.y = Math.PI; grp.add(glow);
    const light = new THREE.PointLight(0xffb347, 4, 5); light.position.z = -1.15; grp.add(light);
    grp.position.set(ex, ey, -1.95); grp.userData = { glow, light };
    ship.add(grp); engines.push(grp);
  }
  for (const sx of [-1, 1]) {
    M(new THREE.BoxGeometry(0.1, 0.1, 0.75), trimMat, [sx * 0.5, 0.12, -2.4], null, [0.32, 0, 0]);   // manipulator upper arm
    M(new THREE.BoxGeometry(0.08, 0.08, 0.55), darkMat, [sx * 0.56, -0.12, -2.78], null, [-0.42, 0, 0]); // forearm
    M(new THREE.BoxGeometry(0.12, 0.12, 0.12), trimMat, [sx * 0.5, 0.02, -2.1]);                     // shoulder joint
  }
  // dorsal rim light (key accent)
  M(new THREE.BoxGeometry(1.36, 0.02, 3.4), armMat, [0, 0.52, -0.3]);

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

    ship.rotation.y = Math.sin(now / 4200) * 0.18 + 0.25;
    ship.rotation.z = Math.sin(now / 5200) * 0.05;

    // engine plasma state: warp(violet) > combat/charging(blue-green) > cruise(orange)
    const cl = document.body.classList;
    const warp = cl.contains('warp-hover');
    const combat = t > 0.001 || cl.contains('combat-mode') || cl.contains('main-cannon-firing');
    const engHex = warp ? 0x8f7cff : (combat ? 0x6fffc0 : 0xffb347);
    const pulse = 0.85 + 0.15 * Math.sin(now / 90);
    engineMat.color.setHex(engHex); engineMat.emissive.setHex(engHex); engineMat.emissiveIntensity = 2.1 * pulse;
    for (const g of engines) { g.userData.light.color.setHex(engHex); g.userData.light.intensity = 4.5 * pulse; }
    muzzle.material.emissiveIntensity = 0.5 + t * 3.6 * (0.7 + 0.3 * Math.sin(now / 60));
    muzzleLight.intensity = t * t * 10;

    // camera dolly: behind the thrusters (t=0) across the hull to the gun (t=1)
    const e = easeInOut(t);
    camera.position.set(lerp(-2.8, 3.2, e), lerp(1.8, 1.1, e), lerp(-6.8, 7.0, e));
    camera.lookAt(0, 0.1, lerp(-1.8, 2.6, e));

    renderer.render(scene, camera);

    ctx.fillStyle = 'rgba(2,4,8,.96)'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(renderer.domElement, 0, 0, w, h);

    const bar = Math.max(10, h * .075);
    ctx.fillStyle = 'rgba(0,0,0,.82)'; ctx.fillRect(0, 0, w, bar); ctx.fillRect(0, h - bar, w, bar);
    ctx.fillStyle = 'rgba(255,235,235,.9)';
    ctx.font = `${Math.max(7, Math.min(w, h) * .046)}px 'JetBrains Mono',monospace`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(lang === 'zh' ? '执法者号 · 粒子脊柱充能' : 'ENFORCER · PARTICLE SPINE CHARGING', 10, bar * .5);
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
