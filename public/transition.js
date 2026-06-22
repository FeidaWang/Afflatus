/* ============================================================
   Afflatus page-transition FX — Web Audio SFX + canvas animations.
     /            → WARP JUMP   (hyperspace starfield)
     /arena.html  → ENERGY LANCE (focused beam + shockwave)
     /sectors.html→ LIFTOFF      (clean rocket ascent + plume)
     /signal.html → CRT TUNE-IN  (waveform + soft static)
   Capture-phase interception; respects prefers-reduced-motion.
   ============================================================ */
(() => {
  'use strict';
  const RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  const TYPE = (path) => /arena\.html?$/.test(path) ? 'cannon' : /sectors\.html?$/.test(path) ? 'takeoff' : /signal\.html?$/.test(path) ? 'control' : /games\.html?$/.test(path) ? 'cyber' : 'warp';
  const PAL = { warp: ['#aae4ff', '#78c8ff'], cannon: ['#3dff9a', '#27e7ff'], takeoff: ['#ffd166', '#ff7a3c'], control: ['#f0b429', '#5fd08a'], cyber: ['#ff2bd6', '#00efff'] };

  // ---------- audio (shared primitives via public/lib/audio.js; inline fallbacks
  //            keep the SFX working even if that lib is missing/late) ----------
  let ac = null, noiseBuf = null;
  const AA = () => window.AfflatusAudio;
  function ctx() { if (AA()) return AA().context(); if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
  function noise(c) { if (AA()) return AA().noise(c, { seconds: 1.2, pink: true }); if (!noiseBuf) { const n = c.sampleRate * 1.2; noiseBuf = c.createBuffer(1, n, c.sampleRate); const d = noiseBuf.getChannelData(0); let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = (w * 0.6 + last * 2); } } const s = c.createBufferSource(); s.buffer = noiseBuf; return s; }
  function env(c, g, t, a, peak, d) { if (AA()) return AA().env(g, t, a, peak, d); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function out(c) { if (AA()) return AA().masterGain(c, RM ? 0.12 : 0.22); const m = c.createGain(); m.gain.value = RM ? 0.12 : 0.22; m.connect(c.destination); return m; }
  function sfx(type) {
    const c = ctx(); if (!c) return; const t = c.currentTime, M = out(c);
    if (type === 'warp') {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(2200, t + 0.55); env(c, g, t, 0.05, 0.5, 0.45); o.connect(g).connect(M); o.start(t); o.stop(t + 0.7);
      const n = noise(c), bp = c.createBiquadFilter(), ng = c.createGain(); bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(6000, t + 0.6); env(c, ng, t, 0.12, 0.5, 0.5); n.connect(bp).connect(ng).connect(M); n.start(t); n.stop(t + 0.7);
    } else if (type === 'takeoff') {
      const n = noise(c), lp = c.createBiquadFilter(), ng = c.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(180, t); lp.frequency.linearRampToValueAtTime(420, t + 0.8); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.6, t + 0.45); ng.gain.linearRampToValueAtTime(0.5, t + 0.75); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.95); n.connect(lp).connect(ng).connect(M); n.start(t); n.stop(t + 1.0);
      const s = c.createOscillator(), sg = c.createGain(); s.type = 'sine'; s.frequency.setValueAtTime(44, t); s.frequency.linearRampToValueAtTime(72, t + 0.85); env(c, sg, t, 0.1, 0.55, 0.7); s.connect(sg).connect(M); s.start(t); s.stop(t + 1.0);
    } else if (type === 'cannon') {
      const ch = c.createOscillator(), cg = c.createGain(); ch.type = 'sine'; ch.frequency.setValueAtTime(420, t); ch.frequency.exponentialRampToValueAtTime(1500, t + 0.22); env(c, cg, t, 0.02, 0.25, 0.18); ch.connect(cg).connect(M); ch.start(t); ch.stop(t + 0.26);
      const z = c.createOscillator(), bp = c.createBiquadFilter(), zg = c.createGain(); z.type = 'sawtooth'; z.frequency.setValueAtTime(1700, t + 0.26); z.frequency.exponentialRampToValueAtTime(180, t + 0.46); bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.value = 900; env(c, zg, t + 0.26, 0.01, 0.55, 0.3); z.connect(bp).connect(zg).connect(M); z.start(t + 0.26); z.stop(t + 0.6);
      const b = c.createOscillator(), bg = c.createGain(); b.type = 'sine'; b.frequency.setValueAtTime(120, t + 0.26); b.frequency.exponentialRampToValueAtTime(55, t + 0.6); env(c, bg, t + 0.26, 0.01, 0.5, 0.4); b.connect(bg).connect(M); b.start(t + 0.26); b.stop(t + 0.7);
    } else if (type === 'control') { // Hiss drone + red impact + rune cluster
      [55, 82.5, 110].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f; o.detune.value = (i - 1) * 8; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.26, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.72); o.connect(g).connect(M); o.start(t); o.stop(t + 0.78); });
      const n = noise(c), bp = c.createBiquadFilter(), ng = c.createGain(); bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.setValueAtTime(1200, t); bp.frequency.exponentialRampToValueAtTime(420, t + 0.6); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.3, t + 0.25); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); n.connect(bp).connect(ng).connect(M); n.start(t); n.stop(t + 0.75);
      const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.3); env(c, g, t, 0.005, 0.4, 0.3); o.connect(g).connect(M); o.start(t); o.stop(t + 0.4);
      [1840, 1972].forEach((f) => { const o2 = c.createOscillator(), g2 = c.createGain(); o2.type = 'square'; o2.frequency.value = f; env(c, g2, t + 0.05, 0.005, 0.06, 0.18); o2.connect(g2).connect(M); o2.start(t + 0.05); o2.stop(t + 0.25); });
    } else { // cyber — neon glitch stab + arp + sub
      const o = c.createOscillator(), bp = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(1400, t + 0.18); bp.type = 'bandpass'; bp.Q.value = 4; bp.frequency.value = 1200; env(c, g, t, 0.01, 0.34, 0.25); o.connect(bp).connect(g).connect(M); o.start(t); o.stop(t + 0.45);
      [660, 880, 1320, 1760].forEach((f, i) => { const o2 = c.createOscillator(), g2 = c.createGain(), dt = i * 0.07; o2.type = 'square'; o2.frequency.value = f; env(c, g2, t + dt, 0.005, 0.12, 0.08); o2.connect(g2).connect(M); o2.start(t + dt); o2.stop(t + dt + 0.12); });
      const n = noise(c), hp = c.createBiquadFilter(), ng = c.createGain(); hp.type = 'highpass'; hp.frequency.value = 2000; env(c, ng, t, 0.005, 0.18, 0.18); n.connect(hp).connect(ng).connect(M); n.start(t); n.stop(t + 0.25);
      const s = c.createOscillator(), sg = c.createGain(); s.type = 'sine'; s.frequency.setValueAtTime(120, t); s.frequency.exponentialRampToValueAtTime(50, t + 0.3); env(c, sg, t, 0.005, 0.4, 0.3); s.connect(sg).connect(M); s.start(t); s.stop(t + 0.4);
    }
  }

  // ---------- visuals ----------
  function overlay() { let el = document.getElementById('fx-overlay'); if (!el) { el = document.createElement('div'); el.id = 'fx-overlay'; el.style.cssText = 'position:fixed;inset:0;z-index:2147483600;pointer-events:none;opacity:0;transition:opacity .12s ease'; const cv = document.createElement('canvas'); cv.style.cssText = 'width:100%;height:100%;display:block'; el.appendChild(cv); document.body.appendChild(el); } return el; }
  function animate(type, dur) {
    const el = overlay(), cv = el.firstChild, c = cv.getContext('2d');
    const W = cv.width = innerWidth, H = cv.height = innerHeight, [c1, c2] = PAL[type], cx = W / 2, cy = H / 2;
    el.style.opacity = '1';
    const t0 = performance.now();
    const stars = (type === 'warp' || type === 'takeoff') ? Array.from({ length: type === 'warp' ? 240 : 90 }, () => ({ a: Math.random() * 6.283, r: Math.random() * 40 + 4, sp: Math.random() * 5 + 3, x: Math.random() * W, y: Math.random() * H, s: Math.random() * 2 + 0.5 })) : null;
    const ease = (p) => 1 - Math.pow(1 - p, 3);
    function frame(now) {
      const p = Math.min(1, (now - t0) / dur);
      c.clearRect(0, 0, W, H);
      c.fillStyle = `rgba(3,5,12,${0.3 + 0.55 * p})`; c.fillRect(0, 0, W, H);
      if (type === 'warp') {
        c.lineCap = 'round';
        for (const s of stars) { const rr = s.r + ease(p) * 1000 * (s.sp / 5); const c1x = cx + Math.cos(s.a) * rr, c1y = cy + Math.sin(s.a) * rr * 0.62, c2x = cx + Math.cos(s.a) * (rr + 26 + p * 160), c2y = cy + Math.sin(s.a) * (rr + 26 + p * 160) * 0.62; c.strokeStyle = Math.random() > 0.5 ? c1 : c2; c.globalAlpha = Math.min(1, 0.15 + p); c.lineWidth = 0.8 + p * 1.6; c.beginPath(); c.moveTo(c1x, c1y); c.lineTo(c2x, c2y); c.stroke(); }
        c.globalAlpha = Math.max(0, p - 0.7) * 3; c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, 60 * p, 0, 6.283); c.fill(); c.globalAlpha = 1;
      } else if (type === 'takeoff') {
        // parallax stars
        c.globalAlpha = 0.7; for (const s of stars) { c.fillStyle = '#cfe0ff'; const yy = (s.y + p * 700 * (s.s)) % H; c.fillRect(s.x, yy, s.s, s.s + p * 6); }
        // rocket rises and shrinks toward top
        const prog = ease(p), ry = cy + 120 - prog * (cy + 220), scale = 1 - prog * 0.7, bw = 26 * scale, bh = 64 * scale;
        c.globalAlpha = 1;
        // exhaust plume (tapered, flickering)
        const flame = bh * (1.3 + Math.random() * 0.5);
        const grd = c.createLinearGradient(0, ry + bh / 2, 0, ry + bh / 2 + flame); grd.addColorStop(0, '#fff'); grd.addColorStop(0.35, c1); grd.addColorStop(1, 'rgba(255,80,20,0)');
        c.fillStyle = grd; c.beginPath(); c.moveTo(cx - bw * 0.42, ry + bh / 2); c.lineTo(cx + bw * 0.42, ry + bh / 2); c.lineTo(cx + (Math.random() - 0.5) * 6, ry + bh / 2 + flame); c.closePath(); c.fill();
        // body
        c.fillStyle = '#e9eefc'; c.beginPath(); c.moveTo(cx, ry - bh / 2); c.lineTo(cx + bw / 2, ry + bh / 2); c.lineTo(cx - bw / 2, ry + bh / 2); c.closePath(); c.fill();
        c.fillStyle = c2; c.beginPath(); c.arc(cx, ry, bw * 0.18, 0, 6.283); c.fill();
        // launch smoke ring at base (early)
        if (p < 0.5) { c.strokeStyle = `rgba(255,209,102,${0.5 - p})`; c.lineWidth = 6 * (1 - p); c.beginPath(); c.arc(cx, cy + 120, 30 + p * 240, 0, 6.283); c.stroke(); }
      } else if (type === 'cannon') {
        if (p < 0.34) { // charge: contracting reticle
          const r = 240 * (1 - p / 0.34) + 16; c.strokeStyle = c2; c.globalAlpha = 0.8; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r, 0, 6.283); c.stroke();
          c.beginPath(); c.arc(cx, cy, r * 0.6, 0, 6.283); c.stroke(); c.globalAlpha = 0.5; for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283 + p * 6; c.fillStyle = c1; c.fillRect(cx + Math.cos(a) * r - 2, cy + Math.sin(a) * r - 2, 4, 4); }
          c.globalAlpha = 1;
        } else { // fire: focused horizontal lance + bloom + shockwave
          const q = (p - 0.34) / 0.66, len = W * Math.min(1, q * 1.8), core = 4 + 26 * Math.sin(Math.min(1, q * 2) * Math.PI);
          for (let layer = 3; layer >= 1; layer--) { c.globalAlpha = 0.18 * layer; c.fillStyle = c2; const h = core * layer; c.fillRect(cx - len / 2, cy - h / 2, len, h); }
          c.globalAlpha = 1; c.fillStyle = '#fff'; c.fillRect(cx - len / 2, cy - core / 6, len, Math.max(2, core / 3));
          c.strokeStyle = c1; c.globalAlpha = Math.max(0, 0.7 - q); c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, q * Math.max(W, H) * 0.7, 0, 6.283); c.stroke();
          c.globalAlpha = Math.max(0, 0.55 - q * 1.2); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
        }
      } else if (type === 'cyber') { // neon glitch slices + grid sweep
        c.fillStyle = `rgba(7,6,15,${0.3 + 0.5 * p})`; c.fillRect(0, 0, W, H);
        c.strokeStyle = c2; c.globalAlpha = 0.22;
        for (let i = 0; i < 14; i++) { const yy = (i / 14 * H + (now * 0.2) % (H / 14)); c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke(); }
        c.globalAlpha = 1;
        for (let i = 0; i < 12; i++) { const sh = H / 12, off = (Math.random() - 0.5) * W * p * 0.7; c.globalAlpha = 0.5; c.fillStyle = i % 2 ? c1 : c2; c.fillRect(off, i * sh, W * (0.2 + Math.random() * 0.5), sh * (0.3 + Math.random() * 0.5)); }
        c.globalAlpha = 0.5; c.fillStyle = c1; c.fillRect(0, cy - H * p * 0.5, W, H * p); c.globalAlpha = 1;
        if (p > 0.5) { c.globalAlpha = Math.max(0, 0.6 - (p - 0.5)); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
        c.globalAlpha = Math.max(0, p - 0.75) * 4; c.fillStyle = '#07060f'; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
      } else { // control: brutalist concrete slabs close, red Hiss leaks, a rune flares
        const e = ease(p);
        c.fillStyle = `rgba(10,9,7,${0.35 + 0.5 * p})`; c.fillRect(0, 0, W, H);
        const slab = e * (W * 0.5 + 30);
        c.fillStyle = '#c7c4bb'; c.fillRect(0, 0, slab, H); c.fillRect(W - slab, 0, slab, H);
        c.fillStyle = '#2a2820'; c.fillRect(slab - 8, 0, 8, H); c.fillRect(W - slab, 0, 8, H);
        c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(slab, 0, 26, H); c.fillRect(W - slab - 26, 0, 26, H);
        const gap = Math.max(0, W - slab * 2);
        if (gap > 2) {
          const gx = slab, grd = c.createLinearGradient(gx, 0, gx + gap, 0);
          grd.addColorStop(0, 'rgba(240,180,41,0)'); grd.addColorStop(0.5, `rgba(240,180,41,${0.45 + 0.3 * Math.sin(now * 0.02)})`); grd.addColorStop(1, 'rgba(240,180,41,0)');
          c.fillStyle = grd; c.fillRect(gx, 0, gap, H);
          c.globalAlpha = 0.6; for (let i = 0; i < 14; i++) { c.fillStyle = Math.random() > 0.5 ? '#f0b429' : '#5fd08a'; c.fillRect(gx + Math.random() * gap, Math.random() * H, 1 + Math.random() * 2, 8 + Math.random() * 44); } c.globalAlpha = 1;
        }
        if (p > 0.45) { const a = Math.min(1, (p - 0.45) / 0.2) * (1 - Math.max(0, (p - 0.82) / 0.18)); c.save(); c.translate(cx, cy); c.rotate(Math.PI / 4); c.globalAlpha = a; c.strokeStyle = c2; c.lineWidth = 3; const s = 26; c.strokeRect(-s, -s, s * 2, s * 2); c.beginPath(); c.moveTo(0, -s * 1.7); c.lineTo(0, s * 1.7); c.moveTo(-s * 1.7, 0); c.lineTo(s * 1.7, 0); c.stroke(); c.restore(); c.globalAlpha = 1; }
        if (Math.random() > 0.55) { c.fillStyle = '#000'; for (let i = 0; i < 4; i++) c.fillRect(0, Math.random() * H, W, 2 + Math.random() * 5); }
        c.globalAlpha = Math.max(0, p - 0.75) * 4; c.fillStyle = '#0a0907'; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
      }
      if (p < 1) requestAnimationFrame(frame); else { el.style.opacity = '0'; setTimeout(() => c.clearRect(0, 0, W, H), 200); }
    }
    requestAnimationFrame(frame);
  }

  // ---------- run + intercept ----------
  let busy = false;
  function run(href, dir) { if (busy) return; busy = true; const type = TYPE(new URL(href, location.href).pathname); try { sfx(type); } catch {} const dur = RM ? 160 : 720; if (!RM) { try { animate(type, dur); document.body.classList.add(dir === 'prev' ? 'turn-prev' : 'turn-next'); } catch {} } setTimeout(() => { window.location.href = href; }, dur); }
  window.AfflatusFX = { run, sfx, type: TYPE };
  function internal(a) { if (!a || a.target === '_blank' || a.hasAttribute('download')) return null; const href = a.getAttribute('href'); if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return null; let u; try { u = new URL(href, location.href); } catch { return null; } if (u.origin !== location.origin) return null; if (!(u.pathname === '/' || /\.html?$/.test(u.pathname))) return null; if (u.pathname === location.pathname) return null; return u.href; }
  document.addEventListener('click', (e) => { if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; const a = e.target.closest && e.target.closest('a[href]'); const href = internal(a); if (!href) return; e.preventDefault(); e.stopImmediatePropagation(); let dir = 'next'; try { dir = (a.dataset.pageTurn === 'prev' || a.dataset.turn === 'prev' || href === new URL(document.body.dataset.prev || '', location.href).href) ? 'prev' : 'next'; } catch {} run(href, dir); }, true);
  document.addEventListener('keydown', (e) => { const tag = (e.target?.tagName || '').toLowerCase(); if (e.metaKey || e.ctrlKey || e.altKey || ['input', 'textarea', 'select'].includes(tag)) return; const prev = document.body.dataset.prev, next = document.body.dataset.next; if (e.key === 'ArrowLeft' && prev) { e.preventDefault(); e.stopImmediatePropagation(); run(prev, 'prev'); } else if (e.key === 'ArrowRight' && next) { e.preventDefault(); e.stopImmediatePropagation(); run(next, 'next'); } }, true);
})();
