/* ============================================================
   Afflatus shared clock helpers (plain <script>; exposes window.AfflatusClock).
   Single source for the countdown duration formatter used across pages.

   fmtDur(ms)    → "Dd HH:MM:SS"  (the leading "Dd " is omitted when days = 0)
   fmtDurSec(s)  → same, from a value already in seconds

   Load this BEFORE the page's own script (arena.js / games.js / …) so the
   global exists by the time a countdown ticks. All defer scripts run in
   document order.
   ============================================================ */
(function () {
  'use strict';
  function fmtDur(ms) {
    let s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    const p = (n) => String(n).padStart(2, '0');
    return (d > 0 ? d + 'd ' : '') + p(h) + ':' + p(m) + ':' + p(s);
  }
  window.AfflatusClock = { fmtDur, fmtDurSec: (s) => fmtDur(s * 1000) };
})();
