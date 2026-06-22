/* ============================================================
   Afflatus shared Web-Audio toolkit (plain <script>; window.AfflatusAudio).
   Low-level primitives shared by the page-transition SFX (transition.js) and
   the Signal ambient bed (signal.html). One AudioContext for the whole site.

   context()                 → the shared AudioContext (created lazily, resumed)
   env(g,t,a,peak,d)         → gain envelope: silence → peak (attack a) → silence (decay d)
   noise(c,{seconds,loop,pink}) → a BufferSource of pink (default) or white noise
   masterGain(c,gain)        → a GainNode → destination (gain defaults respect reduced-motion)

   Load BEFORE transition.js on every page. transition.js also keeps inline
   fallbacks, so a missing/late load never silences the SFX.
   ============================================================ */
(function () {
  'use strict';
  let ac = null;
  const RM = (function () { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  function context() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function noise(c, opts) {
    opts = opts || {};
    const n = Math.floor(c.sampleRate * (opts.seconds || 1.2));
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    if (opts.pink === false) { for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    else { let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = (w * 0.6 + last * 2); } }
    const s = c.createBufferSource(); s.buffer = buf; if (opts.loop) s.loop = true; return s;
  }
  function masterGain(c, gain) {
    const m = c.createGain();
    m.gain.value = (gain == null ? (RM ? 0.12 : 0.22) : gain);
    m.connect(c.destination); return m;
  }
  window.AfflatusAudio = { context, env, noise, masterGain, reduced: RM };
})();
