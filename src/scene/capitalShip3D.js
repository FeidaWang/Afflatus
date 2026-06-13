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

  // central hull — elongated along +Z (nose +Z, stern -Z)
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), hullMat);
  hull.scale.set(0.85, 0.66, 2.9); ship.add(hull);
  // belly keel
  const keel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 4.4), trimMat);
  keel.position.y = -0.42; ship.add(keel);
  // nose cone (forward)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 20), hullMat);
  nose.rotation.x = Math.PI / 2; nose.position.z = 3.0; ship.add(nose);

  // raised cockpit / bridge
  const bridge = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), hullMat);
  bridge.scale.set(0.7, 0.6, 1.1); bridge.position.set(0, 0.5, 0.7); ship.add(bridge);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), glassMat);
  canopy.scale.set(0.7, 0.7, 1.1); canopy.position.set(0, 0.66, 1.0); ship.add(canopy);

  // hull greebles (surface machinery)
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.18 + Math.random() * 0.3, 0.08, 0.18 + Math.random() * 0.4), i % 2 ? darkMat : trimMat);
    g.position.set((Math.random() - 0.5) * 1.1, 0.3 + Math.random() * 0.3, (Math.random() - 0.5) * 4);
    ship.add(g);
  }

  // twin engine nacelles (stern -Z, sides)
  const nacelle = (sx) => {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.7, 18), trimMat);
    body.rotation.x = Math.PI / 2; grp.add(body);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.34, 0.4, 18), darkMat);
    bell.rotation.x = Math.PI / 2; bell.position.z = -0.95; grp.add(bell);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.33, 18), engineMat);
    glow.position.z = -1.16; glow.rotation.y = Math.PI; grp.add(glow);
    const light = new THREE.PointLight(0x6fe0ff, 6, 6); light.position.z = -1.4; grp.add(light);
    grp.position.set(sx, -0.05, -1.9);
    grp.userData.glow = glow; grp.userData.light = light;
    return grp;
  };
  const engL = nacelle(-0.78), engR = nacelle(0.78);
  ship.add(engL, engR);

  // side weapon pods + barrels
  const pod = (sx) => {
    const grp = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 0.5), trimMat);
    arm.position.x = sx * 0.6; grp.add(arm);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 12), darkMat);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(sx * 1.1, 0, 0.9); grp.add(barrel);
    grp.position.set(sx * 0.85, -0.1, 0.4);
    grp.rotation.z = sx * 0.12;
    return grp;
  };
  ship.add(pod(-1), pod(1));

  // forward main-gun spine
  const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.4, 16), trimMat);
  gunBarrel.rotation.x = Math.PI / 2; gunBarrel.position.set(0, 0.05, 2.6); ship.add(gunBarrel);
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 16), darkMat);
    ring.position.set(0, 0.05, 1.8 + i * 0.45); ship.add(ring);
  }
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), gunMat);
  muzzle.position.set(0, 0.05, 3.85); ship.add(muzzle);
  const muzzleLight = new THREE.PointLight(0xff3b30, 0, 6); muzzleLight.position.set(0, 0.05, 4.1); ship.add(muzzleLight);

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
