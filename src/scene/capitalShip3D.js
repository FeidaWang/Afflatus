/**
 * Three.js capital gunship (fig1 "Executor"-inspired): an elongated metallic
 * hull with a raised cockpit, twin rear engine nacelles with glowing bells,
 * side weapon pods + barrels, and a forward main-gun spine that charges.
 *
 * Rendered to an offscreen WebGL canvas and drawImage-d into the existing 2D
 * pilot-feed during the Enforcer main-gun CHARGE phase (camera dollies from the
 * thrusters across the hull to the gun). Falls back to the 2D flyby if WebGL
 * or three.js is unavailable.
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

  scene.add(new THREE.AmbientLight(0x2a3848, 1.4));
  const key = new THREE.DirectionalLight(0xcfe8ff, 2.4); key.position.set(6, 9, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0x5f8fff, 1.6); rim.position.set(-7, 2, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xff9d6a, 0.5); fill.position.set(2, -4, 3); scene.add(fill);

  // ---- materials ----
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x8f9caa, metalness: 0.85, roughness: 0.42 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2c3540, metalness: 0.9, roughness: 0.5 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x55636f, metalness: 0.9, roughness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x14283c, metalness: 0.3, roughness: 0.1, emissive: 0x183048, emissiveIntensity: 0.7 });
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x9af0ff, emissive: 0x6fe0ff, emissiveIntensity: 2.2 });
  const gunMat = new THREE.MeshStandardMaterial({ color: 0xff6a5a, emissive: 0xff3b30, emissiveIntensity: 0.4 });

  const ship = new THREE.Group();

  // ---- segmented armored hull (nose +Z, stern -Z) ----
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 20), hullMat);
  hull.scale.set(0.8, 0.62, 2.95); ship.add(hull);
  // dorsal spine + belly keel
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 4.2), trimMat);
  spine.position.set(0, 0.5, -0.2); ship.add(spine);
  const keel = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.55, 4.2), trimMat);
  keel.position.y = -0.42; ship.add(keel);
  // armor band rings + side armor panels
  for (let i = 0; i < 5; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.05, 8, 26), darkMat);
    band.scale.set(1, 0.78, 1); band.position.z = -1.6 + i * 0.8; ship.add(band);
  }
  for (const sx of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 3.2), trimMat);
    panel.position.set(sx * 0.78, 0, -0.1); ship.add(panel);
  }
  // nose
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.7, 22), hullMat);
  nose.rotation.x = Math.PI / 2; nose.position.z = 3.05; ship.add(nose);

  // ---- forward cockpit pod + canopy ----
  const cockpitPod = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), hullMat);
  cockpitPod.scale.set(0.78, 0.72, 1.2); cockpitPod.position.set(0, 0.42, 1.1); ship.add(cockpitPod);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), glassMat);
  canopy.scale.set(0.78, 0.7, 1.3); canopy.position.set(0, 0.6, 1.35); ship.add(canopy);

  // hull greebles (surface machinery)
  for (let i = 0; i < 22; i++) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.14 + Math.random() * 0.3, 0.07, 0.16 + Math.random() * 0.4), i % 2 ? darkMat : trimMat);
    g.position.set((Math.random() - 0.5) * 1.2, 0.2 + Math.random() * 0.4, (Math.random() - 0.5) * 3.6);
    ship.add(g);
  }

  // ---- raised dorsal engine nacelles (fig1 signature): ribbed body on a pylon ----
  const nacelle = (sx) => {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 2.0, 22), hullMat);
    body.rotation.x = Math.PI / 2; grp.add(body);
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 22), darkMat);
      rib.position.z = -0.7 + i * 0.45; grp.add(rib);
    }
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.47, 0.3, 22), darkMat);
    intake.rotation.x = Math.PI / 2; intake.position.z = 1.05; grp.add(intake);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.36, 0.5, 22), darkMat);
    bell.rotation.x = Math.PI / 2; bell.position.z = -1.1; grp.add(bell);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.37, 22), engineMat);
    glow.position.z = -1.34; glow.rotation.y = Math.PI; grp.add(glow);
    const light = new THREE.PointLight(0x6fe0ff, 6, 7); light.position.z = -1.7; grp.add(light);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.85), trimMat);
    pylon.position.set(0, -0.55, -0.15); pylon.rotation.x = 0.08; grp.add(pylon);
    grp.position.set(sx, 0.55, -1.85);                 // RAISED, at the rear
    grp.userData.glow = glow; grp.userData.light = light;
    return grp;
  };
  const engL = nacelle(-0.62), engR = nacelle(0.62);
  ship.add(engL, engR);

  // ---- side wing-pods + barrels ----
  const pod = (sx) => {
    const grp = new THREE.Group();
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.9), trimMat);
    wing.position.x = sx * 0.7; grp.add(wing);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.7), hullMat);
    tip.position.set(sx * 1.25, 0, 0); grp.add(tip);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 12), darkMat);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(sx * 1.25, 0, 0.95); grp.add(barrel);
    grp.position.set(sx * 0.85, -0.18, 0.2);
    grp.rotation.z = sx * 0.14; grp.rotation.y = sx * -0.06;
    return grp;
  };
  ship.add(pod(-1), pod(1));

  // ---- forward main-gun spine + chin guns ----
  const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.4, 16), trimMat);
  gunBarrel.rotation.x = Math.PI / 2; gunBarrel.position.set(0, -0.05, 2.7); ship.add(gunBarrel);
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 16), darkMat);
    ring.position.set(0, -0.05, 1.8 + i * 0.4); ship.add(ring);
  }
  for (const sx of [-0.32, 0.32]) {
    const chin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 10), darkMat);
    chin.rotation.x = Math.PI / 2; chin.position.set(sx, -0.3, 2.5); ship.add(chin);
  }
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), gunMat);
  muzzle.position.set(0, -0.05, 3.95); ship.add(muzzle);
  const muzzleLight = new THREE.PointLight(0xff3b30, 0, 6); muzzleLight.position.set(0, -0.05, 4.2); ship.add(muzzleLight);

  scene.add(ship);

  // starfield backdrop sprites (cheap)
  const starGeo = new THREE.BufferGeometry();
  const starN = 260, sp = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) { sp[i*3] = (Math.random()-0.5)*60; sp[i*3+1] = (Math.random()-0.5)*40; sp[i*3+2] = -10 - Math.random()*40; }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbfe0ff, size: 0.16, transparent: true, opacity: 0.8 })));

  let lastW = 0, lastH = 0;

  function draw(ctx, w, h, now, t01, lang) {
    const t = clamp(t01, 0, 1);
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    const rw = Math.max(2, Math.floor(w * dpr)), rh = Math.max(2, Math.floor(h * dpr));
    if (rw !== lastW || rh !== lastH) { renderer.setSize(rw, rh, false); camera.aspect = rw / rh; camera.updateProjectionMatrix(); lastW = rw; lastH = rh; }

    // gentle yaw + charge-driven engine/gun intensity
    ship.rotation.y = Math.sin(now / 4200) * 0.18 + 0.25;
    ship.rotation.z = Math.sin(now / 5200) * 0.05;
    const pulse = 0.85 + 0.15 * Math.sin(now / 90);
    engineMat.emissiveIntensity = 2.0 * pulse;
    engL.userData.light.intensity = engR.userData.light.intensity = 5 * pulse;
    muzzle.material.emissiveIntensity = 0.4 + t * 3.5 * (0.7 + 0.3 * Math.sin(now / 60));
    muzzleLight.intensity = t * t * 9;

    // camera dolly: from behind the thrusters (t=0) across the hull to the gun (t=1)
    const e = easeInOut(t);
    camera.position.set(lerp(-2.6, 3.0, e), lerp(1.7, 1.1, e), lerp(-6.4, 6.6, e));
    camera.lookAt(0, 0.1, lerp(-1.6, 2.4, e));

    renderer.render(scene, camera);

    // composite: space backdrop, then the 3D ship, then letterbox + charge HUD
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
