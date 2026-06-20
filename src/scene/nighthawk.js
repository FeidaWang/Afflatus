/**
 * "Nighthawk" — high-detail hard-surface light assault fighter (vacuum-only).
 *
 * Built to the archived spec (ROADMAP.md §4): a triangular armored wedge around
 * a thick central spine; blunt faceted nose; deep-set narrow polarized canopy;
 * two short side weapon pylons (no aero surfaces); a three-engine magnetic-ring
 * cluster (one primary + two auxiliary) with mode-coloured plasma (cruise
 * orange / combat cyan / warp violet); integrated forward particle cannons, a
 * ventral autocannon turret and a dorsal missile-cell block; distributed RCS
 * ports; nav lights (white/amber/red); thin glowing stealth edges; dark military
 * PBR metal (metalness 0.85, roughness 0.55). Forward = +Z.
 *
 *   const nh = createNighthawk(THREE, { glowTex });   // glowTex optional
 *   scene.add(nh.group); nh.setMode('combat'); nh.tick(seconds);
 */
export function createNighthawk(THREE, opts = {}) {
  const glowTex = opts.glowTex || null;
  const group = new THREE.Group();

  const M = {
    hull:  new THREE.MeshStandardMaterial({ color: 0x161b22, metalness: 0.85, roughness: 0.55, flatShading: true }),
    dk:    new THREE.MeshStandardMaterial({ color: 0x0b0e13, metalness: 0.9,  roughness: 0.5,  flatShading: true }),
    plate: new THREE.MeshStandardMaterial({ color: 0x232a35, metalness: 0.8,  roughness: 0.5,  flatShading: true }),
    ring:  new THREE.MeshStandardMaterial({ color: 0x0e1218, metalness: 0.95, roughness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0a1622, metalness: 0.4,  roughness: 0.12, emissive: 0x163a55, emissiveIntensity: 0.7 }),
    edge:  new THREE.MeshBasicMaterial({ color: 0x35d6ff }),                 // glowing stealth rim
    port:  new THREE.MeshBasicMaterial({ color: 0x66e0ff })                  // weapon energy port
  };
  const plasma = new THREE.MeshBasicMaterial({ color: 0x4ad0ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const NAV = {
    red:   new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
    white: new THREE.MeshBasicMaterial({ color: 0xeaffff }),
    amber: new THREE.MeshBasicMaterial({ color: 0xffb020 })
  };

  const add = (geo, mat, pos, rot, scl, parent) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (scl) m.scale.set(scl[0], scl[1], scl[2]);
    (parent || group).add(m);
    return m;
  };

  const navLights = [];   // {mesh, ph}
  const plasmaSprites = [];
  let primaryLight = null;

  // ── fuselage: layered armored wedge around the central spine ─────────────
  add(new THREE.BoxGeometry(4.6, 0.7, 6.0), M.hull,  [0, -0.15, 0]);          // wide belly plate
  add(new THREE.BoxGeometry(3.4, 0.95, 5.6), M.hull, [0,  0.4,  0]);          // mid hull
  add(new THREE.BoxGeometry(2.2, 0.7, 4.6), M.plate, [0,  1.0, -0.2]);        // top deck
  add(new THREE.BoxGeometry(0.95, 0.85, 5.8), M.plate,[0,  1.15, 0]);         // raised central spine
  // chamfer side plates (canted, faceted look)
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.5, 0.9, 5.2), M.hull, [sx * 2.25, 0.35, 0], [0, 0, sx * 0.5]);
  }

  // ── blunt faceted nose (4-sided), forward +Z ─────────────────────────────
  add(new THREE.ConeGeometry(1.5, 2.6, 4), M.hull, [0, 0.2, 3.4], [Math.PI / 2, 0, Math.PI / 4]);
  add(new THREE.BoxGeometry(0.8, 0.7, 0.5), M.dk,  [0, 0.2, 4.55]);            // blunt cap
  // sensor band under the nose
  add(new THREE.BoxGeometry(1.4, 0.2, 0.3), M.dk,  [0, -0.1, 3.6]);

  // ── deep-set narrow polarized canopy (front third) ───────────────────────
  add(new THREE.BoxGeometry(1.05, 0.16, 1.8), M.dk,   [0, 1.3, 1.4]);          // canopy sill
  add(new THREE.BoxGeometry(0.78, 0.42, 1.5), M.glass,[0, 1.52, 1.35], [-0.16, 0, 0]); // tinted glass
  add(new THREE.BoxGeometry(0.12, 0.46, 1.5), M.dk,   [0, 1.54, 1.35], [-0.16, 0, 0]); // centre frame

  // ── side weapon pylons (no aero surfaces) + integrated cannons ───────────
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(2.2, 0.5, 1.7), M.hull,  [sx * 2.3, 0.2, 0.5], [0, sx * -0.12, sx * 0.06]); // pylon arm
    add(new THREE.BoxGeometry(0.95, 0.34, 1.5), M.plate,[sx * 3.45, 0.2, 0.6], [0, sx * -0.28, sx * 0.1]); // outer wedge
    add(new THREE.BoxGeometry(0.06, 0.07, 1.5), M.edge, [sx * 3.92, 0.2, 0.6], [0, sx * -0.28, sx * 0.1]); // glowing leading edge
    add(new THREE.SphereGeometry(0.26, 10, 8), M.dk,    [sx * 3.7, 0.34, -0.2]);                            // sensor pod
    add(new THREE.BoxGeometry(0.34, 0.22, 0.34), M.port,[sx * 1.45, 0.28, 1.7]);                            // particle-cannon port beside cockpit
    // wing-root RCS
    const r = add(new THREE.BoxGeometry(0.16, 0.16, 0.16), NAV.white, [sx * 1.5, 0.55, 1.3]); navLights.push({ mesh: r, ph: Math.random() * 6 });
  }

  // ── dorsal missile-cell block (behind canopy) ────────────────────────────
  add(new THREE.BoxGeometry(1.25, 0.45, 1.5), M.dk, [0, 1.45, -0.5]);
  for (const cx of [-0.32, 0, 0.32]) for (const cz of [-0.34, 0.34]) {
    add(new THREE.BoxGeometry(0.2, 0.06, 0.2), NAV.amber, [cx, 1.69, -0.5 + cz]);
  }

  // ── ventral autocannon turret ────────────────────────────────────────────
  add(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.dk, [0, -0.5, 0.3], [Math.PI, 0, 0]);
  add(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 8), M.dk, [0, -0.68, 0.95], [Math.PI / 2, 0, 0]);

  // ── three-engine magnetic-ring cluster (rear, -Z) ────────────────────────
  add(new THREE.BoxGeometry(4.0, 1.15, 1.2), M.plate, [0, 0.2, -2.7]);        // engine deck
  function engine(x, y, z, r) {
    add(new THREE.CylinderGeometry(r * 0.92, r, 1.0, 18), M.ring, [x, y, z], [Math.PI / 2, 0, 0]);   // housing
    add(new THREE.TorusGeometry(r, r * 0.2, 12, 22), M.ring, [x, y, z - 0.5]);                       // magnetic confinement ring
    add(new THREE.CircleGeometry(r * 0.82, 22), plasma, [x, y, z - 0.52], [0, Math.PI, 0]);          // plasma glow (faces -Z)
    if (glowTex) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: plasma.color.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.scale.setScalar(r * 3.2); s.position.set(x, y, z - 0.8); group.add(s); plasmaSprites.push(s);
    }
  }
  engine(0, 0.25, -3.0, 0.85);    // primary
  engine(-1.65, 0.05, -2.7, 0.5); // auxiliary L
  engine(1.65, 0.05, -2.7, 0.5);  // auxiliary R
  primaryLight = new THREE.PointLight(0x4ad0ff, 4, 14); primaryLight.position.set(0, 0.3, -3.6); group.add(primaryLight);

  // ── rear stabiliser tabs (armored, canted) + nav lights ──────────────────
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.18, 1.0, 1.0), M.plate, [sx * 1.55, 0.85, -2.5], [0, 0, sx * 0.5]);
    const nav = add(new THREE.SphereGeometry(0.12, 8, 6), sx < 0 ? NAV.red : NAV.white, [sx * 1.95, 1.15, -2.3]);
    navLights.push({ mesh: nav, ph: sx < 0 ? 0 : Math.PI });
  }

  // ── surface detail: panel lines, side radiators, antenna, RCS ────────────
  for (const z of [-0.6, 0.5, 1.5]) add(new THREE.BoxGeometry(2.0, 0.02, 0.05), M.dk, [0, 1.36, z]); // panel lines
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.04, 0.5, 0.5), M.plate, [sx * 1.75, 0.5, -1.4 + i * 0.18]); // heat radiators
  add(new THREE.CylinderGeometry(0.018, 0.03, 1.0, 6), M.dk, [0.3, 1.95, -0.3]);  // antenna
  add(new THREE.CylinderGeometry(0.018, 0.03, 0.7, 6), M.dk, [-0.25, 1.85, 0.4]); // antenna 2
  // nose + underside RCS ports
  add(new THREE.BoxGeometry(0.16, 0.16, 0.16), NAV.white, [0, 0.4, 4.35]);
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.14, 0.14, 0.14), NAV.white, [sx * 0.5, 0.05, 3.9]);
    add(new THREE.BoxGeometry(0.16, 0.12, 0.16), NAV.white, [sx * 1.2, -0.45, -1.0]);
  }
  // a couple of weathering/burn patches near the cannons
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.5, 0.04, 0.5), M.dk, [sx * 1.45, 0.42, 1.7]);

  group.rotation.order = 'YXZ';

  // ── exhaust mode colour + idle animation ─────────────────────────────────
  const MODE = { cruise: 0xff9a3c, combat: 0x4ad0ff, warp: 0x7a6cff };
  function setMode(m) {
    const c = new THREE.Color(MODE[m] || MODE.combat);
    plasma.color.copy(c);
    plasmaSprites.forEach((s) => s.material.color.copy(c));
    if (primaryLight) primaryLight.color.copy(c);
  }
  function tick(t) {
    plasma.opacity = 0.78 + 0.2 * Math.sin(t * 6.0);
    if (primaryLight) primaryLight.intensity = 3.4 + 0.8 * Math.sin(t * 6.0);
    for (const n of navLights) n.mesh.scale.setScalar(0.55 + 0.45 * Math.abs(Math.sin(t * 1.8 + n.ph)));
  }

  return { group, setMode, tick };
}
