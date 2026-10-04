import { courseBookCatalog } from '../data/courseBookCatalog.js';
import { courseGroupCopy } from '../data/courseGroupCopy.js';

const stage = document.getElementById('hopeStage');
if (stage) {
  const experience = document.getElementById('hopeExperience');
  const map = document.getElementById('hopeMap');
  const windowEl = document.getElementById('hopeMapWindow');
  const canvas = document.getElementById('hopeMapCanvas');
  const labelsEl = document.getElementById('hopeLabels');
  const nodesEl = document.getElementById('hopeNodes');
  const linesEl = document.getElementById('hopeLines');
  const zoomIn = document.getElementById('hopeZoomIn');
  const zoomOut = document.getElementById('hopeZoomOut');
  const heroWords = [...document.querySelectorAll('#hope-title span')];
  const motionWords = [...stage.querySelectorAll('.hope-stage-title span')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const topics = [
    ['Can I explain it?', '我能解释它吗？'],
    ['Will I use it again?', '我会再次使用吗？'],
    ['Where is the evidence?', '证据在哪里？'],
    ['Can it recover?', '它能恢复吗？'],
    ['Who controls the change?', '谁来决定改变？'],
    ['What is worth keeping?', '什么值得留下？'],
  ];
  const layouts = {
    desktop: { width: 1440, height: 900, centers: [[250, 275], [715, 195], [1190, 270], [1170, 625], [715, 675], [260, 625]] },
    mobile: { width: 720, height: 1320, centers: [[360, 150], [360, 350], [360, 550], [360, 750], [360, 950], [360, 1150]] },
  };
  // Art-directed shelves leave a clear reading area around each question.
  const desktopPositions = [
    [[75,245],[365,100],[475,110],[475,280],[355,390],[190,395]],
    [[575,70],[720,65],[865,80],[935,205],[815,335],[640,335]],
    [[1090,85],[1260,105],[1380,240],[1360,405],[1185,425],[1030,395]],
    [[1020,510],[1150,470],[1280,470],[1380,525],[55,400],[930,650]],
    [[600,500],[735,505],[865,510],[860,795],[720,825],[580,790]],
    [[75,545],[205,490],[380,510],[470,690],[335,805],[155,805]],
  ];
  const language = () => document.documentElement.lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  const localize = (en, zh) => language() === 'zh' ? zh : en;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const smooth = value => value * value * (3 - 2 * value);
  let layout = layouts.desktop;
  let baseScale = 1;
  let scale = 1;
  let pan = { x: 0, y: 0 };
  let drag = null;
  let pointer = null;
  let animationFrame = 0;
  let lastTime = 0;
  let scrollFrame = 0;
  let mapVisible = true;
  let motionEndpoints = [];

  const labels = topics.map(() => {
    const node = document.createElement('div');
    node.className = 'hope-topic';
    node.innerHTML = '<span class="hope-topic-title"></span><span class="hope-topic-caption"></span>';
    labelsEl.append(node);
    return node;
  });

  const bodies = courseBookCatalog.map((book, index) => {
    const button = document.createElement('a');
    button.id = `lesson-${book.id}`;
    button.className = 'hope-node';
    button.dataset.lesson = book.id;
    button.dataset.bookPreview = book.id;
    button.setAttribute('aria-haspopup', 'dialog');
    button.style.backgroundImage = `url("${book.covers[language()]}")`;
    button.style.setProperty('--arrival', String((index * 7 % 11) / 11));
    button.href = `/${language()}/course/book-${book.id}.html`;
    button.title = book.title[language()];
    nodesEl.append(button);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('pathLength', '1');
    linesEl.append(line);
    return { book, button, line, index, x: 0, y: 0, anchorX: 0, anchorY: 0, vx: 0, vy: 0, angle: 0, angularVelocity: 0, width: 0, height: 0, phase: index * 2.39996323 };
  });

  function positionFor(body) {
    const group = body.book.group;
    const serial = body.index % 4;
    const [cx, cy] = layout.centers[group];
    if (layout === layouts.mobile) {
      const xOffsets = [-245, -110, 110, 245];
      const yOffsets = [-45, 85, -85, 45];
      return { x: cx + xOffsets[serial], y: cy + yOffsets[serial] };
    }
    const [x, y] = desktopPositions[group][serial];
    return { x, y };
  }

  function resolveCollisions(delta = 1) {
    for (const body of bodies) {
      body.vx += (body.anchorX - body.x) * .00085 * delta;
      body.vy += (body.anchorY - body.y) * .00085 * delta;
      body.vx += Math.sin(performance.now() * .00022 + body.phase) * .004 * delta;
      body.vy += Math.cos(performance.now() * .00019 + body.phase) * .004 * delta;
      if (pointer && !drag) {
        const dx = body.x - pointer.x, dy = body.y - pointer.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance < 100) {
          const force = (100 - distance) / 100 * .08 * delta;
          body.vx += dx / distance * force;
          body.vy += dy / distance * force;
        }
      }
      body.vx *= Math.pow(.955, delta);
      body.vy *= Math.pow(.955, delta);
      body.x += body.vx * delta;
      body.y += body.vy * delta;
    }
    // AABB contact with positional correction and a damped impulse. Book faces
    // cannot pass through one another, even during the hover disturbance.
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const overlapX = (a.width + b.width) / 2 + 8 - Math.abs(dx);
        const overlapY = (a.height + b.height) / 2 + 8 - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        if (overlapX < overlapY) {
          const sign = Math.sign(dx) || (i % 2 ? 1 : -1);
          const push = overlapX / 2 + .2;
          a.x -= sign * push; b.x += sign * push;
          const relative = (b.vx - a.vx) * sign;
          const impulse = Math.max(.08, -relative * .65);
          a.vx -= sign * impulse; b.vx += sign * impulse;
          a.angularVelocity -= sign * impulse * .016;
          b.angularVelocity += sign * impulse * .016;
        } else {
          const sign = Math.sign(dy) || (j % 2 ? 1 : -1);
          const push = overlapY / 2 + .2;
          a.y -= sign * push; b.y += sign * push;
          const relative = (b.vy - a.vy) * sign;
          const impulse = Math.max(.08, -relative * .65);
          a.vy -= sign * impulse; b.vy += sign * impulse;
          a.angularVelocity += sign * impulse * .014;
          b.angularVelocity -= sign * impulse * .014;
        }
      }
    }
    for (const body of bodies) {
      for (const [cx, cy] of layout.centers) {
        const dx = body.x - cx, dy = body.y - cy;
        const clearanceX = layout === layouts.mobile ? 135 : 175;
        const clearanceY = layout === layouts.mobile ? 30 : 67;
        const overlapX = clearanceX + body.width / 2 - Math.abs(dx);
        const overlapY = clearanceY + body.height / 2 - Math.abs(dy);
        if (overlapX > 0 && overlapY > 0) {
          if (overlapX < overlapY) body.x += (Math.sign(dx) || 1) * overlapX;
          else body.y += (Math.sign(dy) || 1) * overlapY;
        }
      }
      // Reserve the two title corners so every cover stays visible and clickable.
      if (layout === layouts.desktop) {
        if (body.x < 320 && body.y < 170) body.x = 330 + body.width / 2;
        if (body.x > 970 && body.y > 700) body.x = 950 - body.width / 2;
      }
      body.x = clamp(body.x, body.width / 2 + 12, layout.width - body.width / 2 - 12);
      body.y = clamp(body.y, body.height / 2 + 12, layout.height - body.height / 2 - 12);
      body.angularVelocity += -body.angle * .014 * delta;
      body.angularVelocity *= Math.pow(.84, delta);
      body.angle = clamp(body.angle + body.angularVelocity * delta, -8, 8);
    }
  }

  function paintBodies() {
    for (const body of bodies) {
      body.button.style.setProperty('--drift-x', `${(body.x - body.anchorX).toFixed(2)}px`);
      body.button.style.setProperty('--drift-y', `${(body.y - body.anchorY).toFixed(2)}px`);
      body.button.style.setProperty('--tilt', `${body.angle.toFixed(2)}deg`);
      body.line.setAttribute('x1', String(layout.centers[body.book.group][0]));
      body.line.setAttribute('y1', String(layout.centers[body.book.group][1]));
      body.line.setAttribute('x2', body.x.toFixed(2));
      body.line.setAttribute('y2', body.y.toFixed(2));
    }
  }

  function tick(time) {
    animationFrame = 0;
    if (!mapVisible || !map.classList.contains('is-interactive') || reducedMotion.matches || document.hidden) return;
    const delta = clamp((time - (lastTime || time)) / 16.667, .25, 2);
    lastTime = time;
    resolveCollisions(delta);
    paintBodies();
    animationFrame = requestAnimationFrame(tick);
  }
  function startPhysics() {
    if (!animationFrame && !reducedMotion.matches && mapVisible && map.classList.contains('is-interactive') && !document.hidden) {
      lastTime = 0;
      animationFrame = requestAnimationFrame(tick);
    }
  }

  function layoutMap() {
    layout = windowEl.clientWidth <= 700 ? layouts.mobile : layouts.desktop;
    canvas.style.width = `${layout.width}px`;
    canvas.style.height = `${layout.height}px`;
    linesEl.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
    labels.forEach((label, index) => {
      label.style.left = `${layout.centers[index][0]}px`;
      label.style.top = `${layout.centers[index][1]}px`;
    });
    bodies.forEach(body => {
      const position = positionFor(body);
      const size = layout === layouts.mobile ? 68 : 65 + body.index % 3 * 7;
      body.anchorX = body.x = position.x;
      body.anchorY = body.y = position.y;
      body.vx = body.vy = body.angle = body.angularVelocity = 0;
      body.width = size;
      body.height = size * 246 / 240;
      body.button.style.left = `${position.x}px`;
      body.button.style.top = `${position.y}px`;
      body.button.style.width = `${body.width}px`;
      body.button.style.height = `${body.height}px`;
      body.button.style.setProperty('--origin-x', `${(layout.centers[body.book.group][0] - position.x) * .65}px`);
      body.button.style.setProperty('--origin-y', `${(layout.centers[body.book.group][1] - position.y) * .65}px`);
    });
    for (let i = 0; i < 70; i++) resolveCollisions(.4);
    paintBodies();
  }
  function renderTransform() {
    const width = windowEl.clientWidth, height = windowEl.clientHeight;
    const maxX = Math.max(0, (layout.width * scale - width) / 2);
    const maxY = Math.max(0, (layout.height * scale - height) / 2);
    pan.x = clamp(pan.x, -maxX, maxX);
    pan.y = clamp(pan.y, -maxY, maxY);
    canvas.style.transform = `translate(${(width - layout.width * scale) / 2 + pan.x}px,${(height - layout.height * scale) / 2 + pan.y}px) scale(${scale})`;
    zoomOut.disabled = scale <= baseScale + .001;
    zoomIn.disabled = scale >= baseScale * 2.5 - .001;
    windowEl.classList.toggle('is-zoomed', scale > baseScale + .001);
  }
  function fit(reset = false) {
    const ratio = reset ? 1 : scale / baseScale;
    layoutMap();
    baseScale = Math.min(windowEl.clientWidth / layout.width, windowEl.clientHeight / layout.height, 1);
    scale = clamp(baseScale * ratio, baseScale, baseScale * 2.5);
    if (reset) pan = { x: 0, y: 0 };
    renderTransform();
  }
  function zoom(factor) {
    scale = clamp(scale * factor, baseScale, baseScale * 2.5);
    renderTransform();
  }
  zoomIn.addEventListener('click', () => zoom(1.32));
  zoomOut.addEventListener('click', () => zoom(1 / 1.32));

  windowEl.addEventListener('pointerdown', event => {
    if (event.target.closest('a,button') || scale <= baseScale + .001) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    windowEl.setPointerCapture(event.pointerId);
    windowEl.classList.add('is-dragging');
  });
  windowEl.addEventListener('pointermove', event => {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
    if (!drag || drag.id !== event.pointerId) return;
    pan.x = drag.panX + event.clientX - drag.x;
    pan.y = drag.panY + event.clientY - drag.y;
    renderTransform();
  });
  windowEl.addEventListener('pointerleave', () => { pointer = null; });
  const stopDrag = () => { drag = null; windowEl.classList.remove('is-dragging'); };
  windowEl.addEventListener('pointerup', stopDrag);
  windowEl.addEventListener('pointercancel', stopDrag);
  windowEl.addEventListener('lostpointercapture', stopDrag);

  function updateLanguage() {
    labels.forEach((label, index) => {
      label.querySelector('.hope-topic-title').textContent = topics[index][language() === 'zh' ? 1 : 0];
      label.querySelector('.hope-topic-caption').textContent = courseGroupCopy[index][language() === 'zh' ? 3 : 2];
    });
    bodies.forEach(({ book, button }) => {
      button.setAttribute('aria-label', localize(`Book ${book.id}: ${book.title.en}`, `第 ${book.id} 本：${book.title.zh}`));
      button.href = `/${language()}/course/book-${book.id}.html`;
      button.title = book.title[language()];
      button.style.backgroundImage = `url("${book.covers[language()]}")`;
    });
  }

  const stageTop = () => parseFloat(getComputedStyle(stage).top) || 0;
  const mapScrollTop = () => experience.offsetTop + experience.offsetHeight - stage.clientHeight - stageTop();
  const scrollToMap = () => window.scrollTo({ top: mapScrollTop(), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  document.querySelector('.hope-scroll')?.addEventListener('click', event => {
    event.preventDefault();
    history.replaceState(null, '', '#hopeMap');
    scrollToMap();
  });
  document.getElementById('courseStart')?.addEventListener('click', event => {
    event.preventDefault();
    history.replaceState(null, '', '#hopeMap');
    scrollToMap();
  });
  function restoreHash() {
    if (location.hash === '#hopeMap' || /^#lesson-\d{2}$/.test(location.hash)) {
      window.scrollTo({ top: mapScrollTop(), behavior: 'instant' });
      renderScroll();
    }
  }
  window.addEventListener('pageshow', restoreHash);
  window.addEventListener('hashchange', restoreHash);
  window.addEventListener('load', () => requestAnimationFrame(() => requestAnimationFrame(restoreHash)), { once: true });

  function measureMotion() {
    const stageRect = stage.getBoundingClientRect();
    const mobile = stage.clientWidth <= 700;
    const baseSize = parseFloat(getComputedStyle(motionWords[0]).fontSize);
    const endSize = mobile ? 46 : clamp(stage.clientWidth * .073, 66, 110);
    const endScale = endSize / baseSize;
    motionEndpoints = motionWords.map((word, index) => {
      const start = heroWords[index].getBoundingClientRect();
      const endX = index === 0 ? (mobile ? 22 : stage.clientWidth * .032) : stage.clientWidth - (mobile ? 22 : stage.clientWidth * .032) - word.offsetWidth * endScale;
      const endY = index === 0 ? (mobile ? 19 : stage.clientHeight * .025) : stage.clientHeight - (mobile ? 68 : stage.clientHeight * .1) - word.offsetHeight * endScale;
      return { x: start.left - stageRect.left, y: start.top - stageRect.top, endX, endY, endScale };
    });
  }
  function renderScroll() {
    scrollFrame = 0;
    const travel = Math.max(1, experience.offsetHeight - stage.clientHeight);
    const raw = clamp((window.scrollY - experience.offsetTop + stageTop()) / travel, 0, 1);
    // The reference first clears the prose, then separates the two title words.
    // Books travel outward from their subject while fine connections draw in.
    const progress = reducedMotion.matches ? Number(raw >= .5) : smooth(clamp((raw - .12) / .78, 0, 1));
    const reveal = clamp((progress - .16) / .76, 0, 1);
    stage.style.setProperty('--hope-spread', (0.72 + 0.28 * reveal).toFixed(4));
    map.inert = reveal <= .94;
    document.querySelector('.hope-hero').inert = progress > .5;
    stage.style.setProperty('--hope-reveal', reveal.toFixed(4));
    stage.style.setProperty('--hope-copy', (1 - clamp(raw / .22, 0, 1)).toFixed(4));
    motionWords.forEach((word, index) => {
      const point = motionEndpoints[index];
      if (!point) return;
      const x = point.x + (point.endX - point.x) * progress;
      const y = point.y + (point.endY - point.y) * progress;
      const size = 1 + (point.endScale - 1) * progress;
      word.style.transform = `translate3d(${x}px,${y}px,0) scale(${size})`;
    });
    map.classList.toggle('is-interactive', reveal > .94);
    stage.classList.toggle('is-map-ready', reveal > .94);
    document.body.classList.toggle('hope-map-active', raw > .55);
    startPhysics();
  }
  function queueScroll() { if (!scrollFrame) scrollFrame = requestAnimationFrame(renderScroll); }

  fit(true);
  updateLanguage();
  measureMotion();
  renderScroll();
  document.fonts.ready.then(() => { measureMotion(); renderScroll(); });
  window.addEventListener('scroll', queueScroll, { passive: true });
  window.addEventListener('resize', () => { fit(); measureMotion(); renderScroll(); });
  window.addEventListener('afflatus-lang', () => { updateLanguage(); requestAnimationFrame(() => { measureMotion(); renderScroll(); }); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) cancelAnimationFrame(animationFrame); animationFrame = 0; renderScroll(); });
  document.addEventListener('visibilitychange', startPhysics);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { mapVisible = entry.isIntersecting; if (mapVisible) startPhysics(); }, { rootMargin: '30% 0px' }).observe(experience);
  }
  requestAnimationFrame(restoreHash);
}
