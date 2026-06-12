import { clamp, lerp } from '../utils/math.js';

export function progressColor(pct) {
  const p = clamp(pct, 0, 100);
  const t = p <= 25 ? 0 : (p < 50 ? (p - 25) / 25 : (p - 50) / 50);
  const a = p < 50 ? [255, 61, 78] : [255, 212, 93];
  const b = p < 50 ? [255, 212, 93] : [93, 255, 157];
  const mix = a.map((v, i) => Math.round(lerp(v, b[i], t)));
  const dim = mix.map(v => Math.round(v * 0.68));
  return {
    a: `rgba(${dim[0]},${dim[1]},${dim[2]},.42)`,
    b: `rgba(${mix[0]},${mix[1]},${mix[2]},.82)`,
    glow: `rgba(${mix[0]},${mix[1]},${mix[2]},.26)`,
  };
}

export function setProgress(el, pct, axis = 'width') {
  if (!el) return;
  const p = Math.round(clamp(pct, 0, 100));
  const col = progressColor(p);
  el.style.setProperty('--bar-a', col.a);
  el.style.setProperty('--bar-b', col.b);
  el.style.setProperty('--bar-glow', col.glow);
  el.style[axis] = `${p}%`;
}

export function createCombatRuntime({
  weaponCooldownMs,
  createInitialFleetHp,
  getEscorts,
  getCombatFlags,
  getEnforcerCooldown,
  setEnforcerCooldown,
}) {
  const weaponCooldownUntil = { cannon: 0, missile: 0, nuke: 0, enforcer: 0 };
  const weaponCooldownStart = { cannon: 0, missile: 0, nuke: 0, enforcer: 0 };
  const fleetHp = createInitialFleetHp();
  const ammoRecoveryMs = 3600000;
  let ammoServiceStart = 0;
  let ammoServiceUntil = 0;
  let repairServiceStart = 0;
  let repairServiceUntil = 0;
  let bayServiceStart = 0;
  let bayServiceUntil = 0;
  let ammoLevel = 92.0;
  let deckReadiness = 87.3;
  let lastServiceTick = Date.now();

  function fleetHealthAverage() {
    const all = Object.values(fleetHp).flat();
    return all.reduce((s, v) => s + v, 0) / all.length;
  }

  function tickService() {
    const now = Date.now();
    const dt = Math.max(0, now - lastServiceTick);
    lastServiceTick = now;
    ammoLevel = Math.min(100, ammoLevel + (dt / ammoRecoveryMs) * 100);
    const flags = getCombatFlags?.() || {};
    const deckTarget = 90 + Math.sin(now / 6800) * 3.4 - (flags.weaponCutoff ? 14 : 0) - (flags.nukeAlert ? 9 : 0);
    deckReadiness = lerp(deckReadiness, clamp(deckTarget, 38, 96), Math.min(0.04, dt / 9000));
    if (repairServiceUntil > now) {
      const repairRate = dt / 900;
      Object.keys(fleetHp).forEach(type => {
        fleetHp[type].forEach((hp, i) => {
          fleetHp[type][i] = Math.min(100, hp + repairRate);
        });
      });
      getEscorts().forEach(e => {
        if (e.bayIndex !== undefined && fleetHp[e.type]) e.hp = fleetHp[e.type][e.bayIndex];
      });
    }
  }

  function startService(kind, ms, cost = 0) {
    const now = Date.now();
    const next = now + ms;
    if (kind === 'ammo') {
      ammoLevel = clamp(ammoLevel - (cost || Math.max(6, ms / 700)), 0, 100);
      ammoServiceStart = now;
      ammoServiceUntil = now + Math.round((100 - ammoLevel) / 100 * ammoRecoveryMs);
    }
    if (kind === 'repair' && next > repairServiceUntil) {
      repairServiceStart = now;
      repairServiceUntil = next;
    }
    if (kind === 'bay' && next > bayServiceUntil) {
      bayServiceStart = now;
      bayServiceUntil = next;
      deckReadiness = clamp(deckReadiness - (cost || Math.max(4, ms / 1700)), 24, 96);
    }
  }

  function servicePct(start, until) {
    if (!until || Date.now() >= until) return 100;
    return Math.round(clamp((Date.now() - start) / (until - start) * 100, 0, 100));
  }

  function serviceActive() {
    const now = Date.now();
    return repairServiceUntil > now || ammoServiceUntil > now || bayServiceUntil > now;
  }

  function hpFor(type, index) {
    return Math.round((fleetHp[type] && fleetHp[type][index]) || 100);
  }

  function startWeaponCooldown(type, ms = weaponCooldownMs[type] || 30000) {
    const now = Date.now();
    weaponCooldownStart[type] = now;
    weaponCooldownUntil[type] = now + ms;
    if (type === 'enforcer') setEnforcerCooldown(weaponCooldownUntil[type]);
  }

  function weaponRemaining(type) {
    const until = type === 'enforcer'
      ? Math.max(getEnforcerCooldown(), weaponCooldownUntil.enforcer || 0)
      : (weaponCooldownUntil[type] || 0);
    return Math.max(0, until - Date.now());
  }

  function weaponReady(type) {
    return weaponRemaining(type) <= 0;
  }

  function weaponCooldownRatio(type) {
    const rem = weaponRemaining(type);
    if (rem <= 0) return 1;
    const ms = weaponCooldownMs[type] || 30000;
    return clamp((Date.now() - (weaponCooldownStart[type] || Date.now())) / ms, 0, 1);
  }

  return {
    fleetHp,
    fleetHealthAverage,
    hpFor,
    serviceActive,
    servicePct,
    setProgress,
    startService,
    startWeaponCooldown,
    tickService,
    weaponCooldownRatio,
    weaponReady,
    weaponRemaining,
    getAmmoLevel: () => ammoLevel,
    getDeckReadiness: () => deckReadiness,
    getServiceWindows: () => ({
      ammoServiceStart,
      ammoServiceUntil,
      repairServiceStart,
      repairServiceUntil,
      bayServiceStart,
      bayServiceUntil,
    }),
  };
}
