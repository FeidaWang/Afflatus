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

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2);

export function createCapitalShip3D() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);

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
  const engineMat = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xffa030, emissiveIntensity: 2.0 });
  const gunMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x6fb4ff, emissiveIntensity: 0.5 });

  const ship = new THREE.Group();
  const M = (geo, mat, t, s, r) => { const m = new THREE.Mesh(geo, mat); if (t) m.position.set(t[0], t[1], t[2]); if (s) m.scale.set(s[0], s[1], s[2]); if (r) m.rotation.set(r[0], r[1], r[2]); ship.add(m); return m; };

  // ===== flat triangular wedge bow (nose +Z) =====
  M(new THREE.ConeGeometry(1.05, 3.4, 4), hullMat, [0, -0.02, 2.3], [1, 0.32, 1], [Math.PI / 2, 0, Math.PI / 4]); // wide flat faceted nose
  M(new THREE.BoxGeometry(1.5, 0.34, 1.6), armMat, [0, 0.04, 1.5]);                       // forward deck
  for (let i = 0; i < 4; i++) M(new THREE.BoxGeometry(1.4 - i * 0.18, 0.04, 0.16), trimMat, [0, 0.22, 2.2 - i * 0.45]); // bow panel seams
  // off-centre twin-rail bow turret + "01" plate
  const turret = M(new THREE.BoxGeometry(0.42, 0.2, 0.42), darkMat, [-0.34, 0.26, 1.1]);
  for (const bx of [-0.46, -0.22]) M(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), trimMat, [bx, 0.3, 1.55], null, [Math.PI / 2, 0, 0]);
  M(new THREE.BoxGeometry(0.14, 0.1, 0.02), trimMat, [-0.34, 0.3, 0.9]);                  // "01" marker plate

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
  const engines = [];
  for (const [ex, ey] of [[-0.62, 0.12], [0.62, 0.12], [-0.62, -0.3], [0.62, -0.3], [0, 0.42]]) {
    const grp = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 1.0), trimMat); grp.add(housing);     // rectangular pod
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.4), darkMat); shield.position.set(0, 0.24, -0.2); grp.add(shield); // heat shield
    const cavity = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.16), darkMat); cavity.position.z = -0.5; grp.add(cavity);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.24), engineMat); glow.position.z = -0.56; glow.rotation.y = Math.PI; grp.add(glow);
    const light = new THREE.PointLight(0xffb347, 3.5, 5); light.position.z = -0.85; grp.add(light);
    grp.position.set(ex, ey, -2.1); grp.userData = { glow, light };
    ship.add(grp); engines.push(grp);
  }
  // support struts
  for (const sx of [-1, 1]) M(new THREE.BoxGeometry(0.08, 0.08, 0.8), darkMat, [sx * 0.62, -0.1, -1.7]);
  // stabiliser fins (sharp stealth shapes)
  for (const sx of [-1, 1]) M(new THREE.BoxGeometry(0.06, 0.7, 0.7), armMat, [sx * 0.9, 0.3, -2.0], null, [0.2, 0, sx * 0.4]);
  M(new THREE.BoxGeometry(0.5, 0.5, 0.06), armMat, [0, 0.45, -2.4], null, [0.3, 0, 0]);   // vertical tail
  // antenna mast + rods
  M(new THREE.CylinderGeometry(0.015, 0.02, 1.2, 6), trimMat, [0.15, 0.9, -1.9]);
  M(new THREE.SphereGeometry(0.035, 6, 5), redMat, [0.15, 1.5, -1.9]);
  for (const sx of [-1, 1]) M(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 5), trimMat, [sx * 0.5, 0.1, -2.5], null, [Math.PI / 3, 0, sx * 0.3]);

  // ===== forward spinal main gun (fires through the bow channel) =====
  M(new THREE.CylinderGeometry(0.12, 0.16, 2.6, 14), trimMat, [0, -0.05, 2.0], null, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) M(new THREE.TorusGeometry(0.18, 0.04, 6, 16), darkMat, [0, -0.05, 1.2 + i * 0.5]);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), gunMat); muzzle.position.set(0, -0.05, 3.5); ship.add(muzzle);
  const muzzleLight = new THREE.PointLight(0x7fb8ff, 0, 7); muzzleLight.position.set(0, -0.05, 3.8); ship.add(muzzleLight);

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

    ship.rotation.y = Math.sin(now / 4200) * 0.16 + 0.3;
    ship.rotation.z = Math.sin(now / 5200) * 0.04;

    const cl = document.body.classList;
    const warp = cl.contains('warp-hover');
    const combat = t > 0.001 || cl.contains('combat-mode') || cl.contains('main-cannon-firing');
    const engHex = warp ? 0x8f7cff : (combat ? 0x6fffc0 : 0xffb347);
    const pulse = 0.85 + 0.15 * Math.sin(now / 90);
    engineMat.color.setHex(engHex); engineMat.emissive.setHex(engHex); engineMat.emissiveIntensity = 2.1 * pulse;
    for (const g of engines) { g.userData.light.color.setHex(engHex); g.userData.light.intensity = 4 * pulse; }
    muzzle.material.emissiveIntensity = 0.5 + t * 3.6 * (0.7 + 0.3 * Math.sin(now / 60));
    muzzleLight.intensity = t * t * 10;

    // 3/4 top-front dolly from the engines to the gun
    const e = easeInOut(t);
    camera.position.set(lerp(-3.2, 3.4, e), lerp(2.4, 1.6, e), lerp(-7.2, 7.0, e));
    camera.lookAt(0, 0.2, lerp(-2.0, 2.4, e));

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
