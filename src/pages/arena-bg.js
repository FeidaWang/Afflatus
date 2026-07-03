/* ============================================================
   Arena background - static PCB / chip substrate.
   The previous moving segmented "caterpillar" effect has been removed.
   ============================================================ */
(() => {
  'use strict';

  const cv = document.getElementById('bgCanvas');
  if (!cv || !cv.getContext) return;

  const ctx = cv.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0;
  let H = 0;
  let board = null;

  function rng(seed) {
    let v = seed >>> 0;
    return () => {
      v += 0x6D2B79F5;
      let t = v;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildBoard() {
    const rnd = rng(26052026 + W * 3 + H);
    const px = (n) => n * dpr;
    board = document.createElement('canvas');
    board.width = W;
    board.height = H;

    const b = board.getContext('2d');
    b.clearRect(0, 0, W, H);

    const grid = px(52);
    b.lineWidth = px(1);

    for (let i = 0; i < Math.ceil(W / grid) + 2; i++) {
      const x = i * grid + (rnd() * 20 - 10) * dpr;
      let y = 0;
      b.beginPath();
      b.moveTo(x, 0);
      while (y < H) {
        const seg = px(40 + rnd() * 80);
        b.lineTo(x, y + seg);
        if (rnd() < 0.42) {
          const dx = (rnd() < 0.5 ? -1 : 1) * grid;
          b.lineTo(x + dx, y + seg);
        }
        y += seg;
      }
      b.strokeStyle = 'rgba(90,120,180,0.10)';
      b.stroke();
    }

    for (let j = 0; j < Math.ceil(H / grid) + 2; j++) {
      const y = j * grid + (rnd() * 20 - 10) * dpr;
      b.beginPath();
      b.moveTo(0, y);
      b.lineTo(W, y);
      b.strokeStyle = 'rgba(90,120,180,0.055)';
      b.stroke();
    }

    const viaCount = Math.max(40, Math.floor((W * H) / (px(90) * px(90))));
    for (let i = 0; i < viaCount; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      b.fillStyle = rnd() > 0.18 ? 'rgba(39,231,255,0.14)' : 'rgba(61,255,154,0.13)';
      b.fillRect(x, y, px(2), px(2));
    }

    for (let i = 0; i < 8; i++) {
      const cw = px(42 + rnd() * 72);
      const ch = px(28 + rnd() * 48);
      const x = rnd() * Math.max(1, W - cw);
      const y = rnd() * Math.max(1, H - ch);
      b.strokeStyle = 'rgba(58,91,255,0.15)';
      b.fillStyle = 'rgba(58,91,255,0.045)';
      b.fillRect(x, y, cw, ch);
      b.strokeRect(x, y, cw, ch);
      b.fillStyle = 'rgba(120,150,210,0.12)';
      for (let p = px(4); p < cw - px(4); p += px(7)) {
        b.fillRect(x + p, y - px(3), px(2), px(3));
        b.fillRect(x + p, y + ch, px(2), px(3));
      }
      for (let p = px(4); p < ch - px(4); p += px(7)) {
        b.fillRect(x - px(3), y + p, px(3), px(2));
        b.fillRect(x + cw, y + p, px(3), px(2));
      }
    }

    b.strokeStyle = 'rgba(61,255,154,0.08)';
    b.lineWidth = px(1);
    for (let i = 0; i < 16; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const w = px(30 + rnd() * 120);
      const h = px(20 + rnd() * 70);
      b.strokeRect(x, y, w, h);
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    if (board) ctx.drawImage(board, 0, 0);
  }

  function init() {
    W = cv.width = Math.floor(innerWidth * dpr);
    H = cv.height = Math.floor(innerHeight * dpr);
    cv.style.width = `${innerWidth}px`;
    cv.style.height = `${innerHeight}px`;
    buildBoard();
    render();
  }

  init();

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(init, 200);
  });
})();
