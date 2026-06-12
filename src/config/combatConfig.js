export const DEFENSE_ATTACK_TIME_SCALE = 2;
export const DEFENSE_PROJECTILE_SPEED_SCALE = 1 / DEFENSE_ATTACK_TIME_SCALE;
export const MISSILE_DROP_MS = 700 * DEFENSE_ATTACK_TIME_SCALE;
export const MISSILE_IGNITE_MS = 1500 * DEFENSE_ATTACK_TIME_SCALE;
export const MISSILE_RAMP_MS = 2600 * DEFENSE_ATTACK_TIME_SCALE;

export const WEAPON_COOLDOWN_MS = Object.freeze({
  cannon: 30000,
  missile: 45000,
  nuke: 60000,
  enforcer: 90000,
});

export const TOTAL_FIGHTERS = 6;
export const TOTAL_BOMBERS = 2;

export const WEAPON_NAMES = Object.freeze({
  cannon: ['密集阵', 'CIWS'],
  missile: ['导弹', 'MISSILE'],
  nuke: ['核打击', 'NUKE'],
  enforcer: ['主炮', 'MAIN GUN'],
  auto: ['自动', 'AUTO'],
});

export function createInitialFleetHp() {
  return {
    f47: Array(TOTAL_FIGHTERS).fill(100),
    b2: [100],
    b1b: [100],
  };
}
