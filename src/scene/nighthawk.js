/**
 * "Nighthawk" — light assault fighter, styled as a fighter-scale sibling of the
 * TC CONDOR / Enforcer capital ship (src/scene/capitalShip3D.js): gunmetal
 * armoured central fuselage with a raised command spine + bump-mapped panel
 * relief, a flat faceted wedge nose, TWO forward-protruding laser-cannon rods,
 * short Su-47-style FORWARD-SWEPT side wings, and a rear cluster of TWIN
 * side-by-side turbine nozzles. Engine plasma follows the flight phase:
 * cruise orange · combat cyan · warp violet. Forward = +Z.
 *
 *   const nh = createNighthawk(THREE, { glowTex });   // glowTex optional
 *   scene.add(nh.group); nh.setMode('combat'); nh.tick(seconds);
 */
export function createNighthawk(THREE, opts = {}) {
  const glowTex = opts.glowTex || null;
  const group = new THREE.Group();

  // ── procedural panel-line / rivet bump (the "metal armour tech" feel) ──
  const bc = document.createElement('canvas'); bc.width = bc.height = 256;
  const bx = bc.getContext('2d');
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, 256, 256);
  bx.strokeStyle = '#3a3a3a'; bx.lineWidth = 2;
  for (let i = 0; i < 12; i++) { const a = Math.random() * 256, b = Math.random() * 256; bx.beginPath(); bx.moveTo(a, 0); bx.lineTo(a, 256); bx.moveTo(0, b); bx.lineTo(256, b); bx.stroke(); }
  for (let i = 0; i < 26; i++) { bx.strokeStyle = Math.random() < 0.5 ? '#585858' : '#a2a2a2'; bx.strokeRect(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 56, 10 + Math.random() * 56); }
  for (let i = 0; i < 90; i++) { bx.fillStyle = Math.random() < 0.5 ? '#9a9a9a' : '#565656'; bx.beginPath(); bx.arc(Math.random() * 256, Math.random() * 256, 1.2, 0, 7); bx.fill(); }
  const bump = new THREE.CanvasTexture(bc); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(2, 2);

  const mk = (color, metalness, roughness) => { const m = new THREE.MeshStandardMaterial({ color, metalness, roughness }); m.bumpMap = bump; m.bumpScale = 0.012; return m; };
  const M = {
    hull:  mk(0x4a525c, 0.8, 0.55),
    arm:   mk(0x3a414a, 0.78, 0.62),
    dark:  mk(0x21262d, 0.85, 0.58),
    trim:  mk(0x6b7682, 0.9, 0.4),
    glass: new THREE.MeshStandardMaterial({ color: 0x0a1622, metalness: 0.4, roughness: 0.14, emissive: 0x1a3f5a, emissiveIntensity: 0.7 }),
    gun:   new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x5aa0ff, emissiveIntensity: 0.6 })
  };
  const plasma = new THREE.MeshBasicMaterial({ color: 0x6fe8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const plume  = new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const NAV = { red: new THREE.MeshBasicMaterial({ color: 0xff3b30 }), white: new THREE.MeshBasicMaterial({ color: 0xeaffff }) };

  const add = (geo, mat, p, r, s, parent) => {
    const m = new THREE.Mesh(geo, mat);
    if (p) m.position.set(p[0], p[1], p[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    if (s) m.scale.set(s[0], s[1], s[2]);
    (parent || group).add(m); return m;
  };

  const navLights = [], plumes = [], plasmaSprites = [], fans = [];
  let primaryLight = null;

  // ── central armoured fuselage + raised command spine ─────────────────────
  add(new THREE.BoxGeometry(1.9, 0.45, 5.4), M.hull, [0, -0.15, -0.1]);     // keel / belly
  add(new THREE.BoxGeometry(1.5, 0.62, 5.0), M.hull, [0, 0.25, -0.1]);      // mid hull
  add(new THREE.BoxGeometry(0.66, 0.5, 4.4), M.arm,  [0, 0.62, -0.2]);      // raised command spine
  add(new THREE.BoxGeometry(0.34, 0.5, 3.0), M.dark, [0, -0.42, 0.1]);      // ventral keel fin
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.4, 0.7, 4.4), M.arm, [sx * 0.85, 0.18, -0.1], [0, 0, sx * 0.42]); // canted side armour
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(1.54, 0.04, 0.22), M.trim, [0, 0.57, -1.9 + i * 0.62]); // dorsal plate seams

  // ── flat faceted wedge nose ──────────────────────────────────────────────
  add(new THREE.ConeGeometry(0.95, 2.6, 4), M.hull, [0, 0.02, 3.1], [Math.PI / 2, 0, Math.PI / 4], [1, 0.55, 1]);
  add(new THREE.BoxGeometry(1.1, 0.28, 1.5), M.arm, [0, 0.18, 1.9]);        // forward deck
  for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.9 - i * 0.14, 0.03, 0.06), M.dark, [0, 0.33, 2.6 - i * 0.34]); // bow seams

  // ── TWO forward-protruding laser-cannon rods ─────────────────────────────
  for (const bxp of [-0.34, 0.34]) {
    add(new THREE.BoxGeometry(0.26, 0.26, 0.7), M.dark, [bxp, 0.2, 2.6]);                                   // gun housing
    add(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 12), M.trim, [bxp, 0.2, 3.9], [Math.PI / 2, 0, 0]);     // rod
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 12), M.dark, [bxp, 0.2, 5.15], [Math.PI / 2, 0, 0]);    // muzzle
    add(new THREE.SphereGeometry(0.07, 10, 8), M.gun, [bxp, 0.2, 5.4]);                                     // emitter tip (glows)
  }

  // ── deep-set polarized canopy on the spine ───────────────────────────────
  add(new THREE.BoxGeometry(0.62, 0.12, 1.2), M.dark, [0, 0.84, 1.0]);
  add(new THREE.BoxGeometry(0.44, 0.3, 1.0), M.glass, [0, 0.98, 0.95], [-0.16, 0, 0]);

  // ── short Su-47 forward-swept wings (tips ahead of roots) ────────────────
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(2.0, 0.1, 1.1), M.hull,  [sx * 1.45, 0.06, 0.1], [0, -sx * 0.42, sx * 0.05]); // forward-swept wing slab
    add(new THREE.BoxGeometry(1.9, 0.05, 0.34), M.arm, [sx * 1.45, 0.13, 0.45], [0, -sx * 0.42, 0]);        // overlapping plate
    add(new THREE.BoxGeometry(0.22, 0.16, 0.6), M.dark,[sx * 2.45, 0.04, 0.7], [0, -sx * 0.42, 0]);         // wingtip hardpoint pod
    add(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 8), M.trim, [sx * 2.45, 0.04, 1.05], [Math.PI / 2, 0, 0]); // tip rail
    add(new THREE.BoxGeometry(0.8, 0.06, 0.36), M.arm, [sx * 0.66, 0.32, 2.2], [0, -sx * 0.3, 0]);          // small forward canard
    const nav = add(new THREE.SphereGeometry(0.06, 8, 6), sx < 0 ? NAV.red : NAV.white, [sx * 2.55, 0.07, 1.2]);
    navLights.push({ mesh: nav, ph: sx < 0 ? 0 : Math.PI });
  }

  // ── rear TWIN side-by-side turbine nozzles ───────────────────────────────
  add(new THREE.BoxGeometry(2.2, 0.7, 1.2), M.arm, [0, 0.1, -2.7]);         // engine deck
  function turbine(x) {
    add(new THREE.CylinderGeometry(0.5, 0.55, 1.9, 20), M.trim, [x, 0.12, -2.7], [Math.PI / 2, 0, 0]);      // pod housing
    add(new THREE.TorusGeometry(0.5, 0.07, 12, 22), M.dark, [x, 0.12, -1.8]);                               // front intake ring
    const fan = new THREE.Group(); fan.position.set(x, 0.12, -1.78); group.add(fan); // turbine fan (faces -Z)
    add(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 18), M.dark, [0, 0, 0], [Math.PI / 2, 0, 0], null, fan); // hub disc
    for (let b = 0; b < 8; b++) { const a = b * Math.PI / 4; add(new THREE.BoxGeometry(0.07, 0.34, 0.02), M.trim, [Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.04], [0, 0, a], null, fan); } // blades
    fans.push(fan);
    add(new THREE.TorusGeometry(0.5, 0.09, 12, 22), M.dark, [x, 0.12, -3.65]);                              // exhaust nozzle ring
    add(new THREE.CircleGeometry(0.42, 22), plasma, [x, 0.12, -3.7], [0, Math.PI, 0]);                      // plasma disc (faces -Z)
    const pl = new THREE.Mesh(new THREE.ConeGeometry(0.34, 2.4, 14), plume.clone()); pl.rotation.x = Math.PI / 2; pl.position.set(x, 0.12, -5.0); group.add(pl); plumes.push(pl);
    if (glowTex) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: plasma.color.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(1.8); s.position.set(x, 0.12, -3.95); group.add(s); plasmaSprites.push(s); }
  }
  turbine(-0.55); turbine(0.55);
  primaryLight = new THREE.PointLight(0x6fe8ff, 4, 16); primaryLight.position.set(0, 0.15, -4.2); group.add(primaryLight);

  // ── rear stabiliser fins + antenna + detail greebles ─────────────────────
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.7, 0.7), M.arm, [sx * 1.15, 0.45, -2.6], [0.2, 0, sx * 0.4]);
  add(new THREE.BoxGeometry(0.5, 0.5, 0.06), M.arm, [0, 0.5, -3.0], [0.3, 0, 0]);          // vertical tail
  add(new THREE.CylinderGeometry(0.014, 0.024, 1.6, 6), M.trim, [0.12, 1.05, -1.6]);       // antenna mast
  add(new THREE.SphereGeometry(0.03, 6, 5), NAV.red, [0.12, 1.86, -1.6]);
  for (let i = 0; i < 22; i++) { const x = (Math.random() - 0.5) * 1.3, z = -1.6 + Math.random() * 3.4; add(new THREE.BoxGeometry(0.06 + Math.random() * 0.14, 0.02, 0.08 + Math.random() * 0.22), Math.random() < 0.5 ? M.trim : M.dark, [x, 0.58, z]); } // dorsal greebles
  for (const sx of [-1, 1]) { add(new THREE.BoxGeometry(0.16, 0.14, 0.16), NAV.white, [sx * 0.7, 0.34, 1.6]); } // forward RCS

  group.rotation.order = 'YXZ';

  // ── exhaust mode colour + idle animation ─────────────────────────────────
  const MODE = { cruise: 0xff9a3c, combat: 0x6fe8ff, warp: 0x7a6cff };
  function setMode(m) {
    const c = new THREE.Color(MODE[m] || MODE.combat);
    plasma.color.copy(c);
    plumes.forEach((p) => p.material.color.copy(c));
    plasmaSprites.forEach((s) => s.material.color.copy(c));
    if (primaryLight) primaryLight.color.copy(c);
  }
  function tick(t) {
    const f = 0.85 + 0.15 * Math.sin(t * 7);
    plasma.opacity = 0.8 * f;
    plumes.forEach((p, i) => { p.material.opacity = 0.5 * f; p.scale.set(1, 0.9 + 0.2 * Math.sin(t * 6 + i), 1); });
    if (primaryLight) primaryLight.intensity = 3.4 + 0.8 * Math.sin(t * 7);
    fans.forEach((fn, i) => { fn.rotation.z = t * (6 + i); });
    for (const n of navLights) n.mesh.scale.setScalar(0.55 + 0.45 * Math.abs(Math.sin(t * 1.8 + n.ph)));
  }

  return { group, setMode, tick };
}
