// iPhone's native video entry must run directly in the user's click handler.
export async function enterFilmFullscreen(player, video, { mobile = false, orientation = globalThis.screen?.orientation } = {}) {
  if (mobile && typeof video.webkitEnterFullscreen === 'function') {
    try { video.webkitEnterFullscreen(); return 'native'; } catch { /* Try element fullscreen next. */ }
  }
  if (!player.requestFullscreen) return 'fallback';
  try { await player.requestFullscreen({ navigationUI: 'hide' }); } catch { return 'fallback'; }
  if (player.ownerDocument.fullscreenElement !== player) return 'fallback';
  if (mobile) await lockFilmLandscape(orientation);
  return 'element';
}
export async function lockFilmLandscape(orientation = globalThis.screen?.orientation) {
  try { await orientation?.lock?.('landscape'); } catch { /* Retain the portrait CSS landscape layout. */ }
}

export function unlockFilmOrientation(orientation = globalThis.screen?.orientation) {
  try { orientation?.unlock?.(); } catch { /* Some browsers expose an unsupported unlock method. */ }
}
