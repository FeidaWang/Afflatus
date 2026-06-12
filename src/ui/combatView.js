export function createCombatViewState() {
  let view = {
    mode: 'standby',
    until: 0,
    weapon: null,
    flash: 0,
  };

  function set(mode, subject = null, ms = 4200) {
    const now = Date.now();
    view = {
      mode,
      weapon: mode === 'missile' ? subject : null,
      craft: (!['missile', 'mosaic', 'ciws', 'offline', 'nukeAuth', 'nemp', 'mainGun'].includes(mode)) ? subject : null,
      target: (mode === 'ciws' || mode === 'offline' || mode === 'mainGun' || mode === 'nemp') ? subject : null,
      until: now + ms,
      started: now,
      bannerUntil: (['combat', 'missile', 'launch', 'landing'].includes(mode)) ? now + 2600 : 0,
      trackSeed: Math.random() * Math.PI * 2,
      flash: mode === 'mosaic' ? 1 : 0,
    };
    return view;
  }

  return {
    set,
    get view() {
      return view;
    },
  };
}
