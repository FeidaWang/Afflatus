// What the compact menu does beyond showing and hiding: open on the current group,
// take focus, and page through the "Latest" cards. header-controller.js imports this
// the first time the menu opens, so no page pays for it until then.
const header = document.querySelector('#afflatus-header');
const menu = header.querySelector('.af-header-menu');
const compact = matchMedia('(max-width: 979px)');
const nav = document.getElementById('af-primary-nav');
const language = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
const COPY = {
  label: { en: 'Latest', zh: '最新' },
  previous: { en: 'Previous card', zh: '上一张' },
  next: { en: 'Next card', zh: '下一张' },
};

function make(tag, className, ...children) {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
}
function text(tag, className, copy) {
  const node = make(tag, className, copy[language]);
  node.dataset.en = copy.en;
  node.dataset.zh = copy.zh;
  return node;
}
function labelled(node, copy) {
  node.setAttribute('aria-label', copy[language]);
  node.dataset.ariaEn = copy.en;
  node.dataset.ariaZh = copy.zh;
  return node;
}
function pageButton(copy, glyph) {
  const button = labelled(make('button', '', glyph), copy);
  button.type = 'button';
  return button;
}

function renderCard({ href, label, date, title, cover }, index) {
  const time = date && text('time', '', date.label);
  if (time) time.dateTime = date.iso;
  const image = make('img', '');
  image.src = cover;
  image.alt = '';
  image.decoding = 'async';
  if (index) image.loading = 'lazy';
  const card = make('a', 'af-menu-latest-card',
    make('p', 'af-menu-latest-meta', ...[text('span', '', label), time].filter(Boolean)),
    image,
    text('p', 'af-menu-latest-title', title));
  card.href = href[language];
  return card;
}

function render(cards) {
  const track = make('div', 'af-menu-latest-track', ...cards.map(renderCard));
  const previous = pageButton(COPY.previous, '←');
  const next = pageButton(COPY.next, '→');
  const count = make('span', 'af-menu-latest-count');
  count.setAttribute('aria-live', 'polite');
  const position = () => Math.round(track.scrollLeft / track.clientWidth) || 0;
  const pad = (value) => String(value).padStart(2, '0');
  const showCount = () => { count.textContent = `${pad(position() + 1)} / ${pad(cards.length)}`; };
  const go = (step) => track.scrollTo({
    left: ((position() + step + cards.length) % cards.length) * track.clientWidth,
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
  previous.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  track.addEventListener('scroll', showCount, { passive: true });
  showCount();
  nav.append(labelled(make('section', 'af-menu-latest', track, make('div', 'af-menu-latest-pager', previous, count, next)), COPY.label));
}

// The carousel is an extra: if it cannot load, the menu still has every link.
fetch('/menu-latest.json')
  .then((response) => (response.ok ? response.json() : []))
  .then((cards) => { if (cards.length) render(cards); })
  .catch(() => {});

// Set here rather than with html:has() in CSS, which slows every page's style recalculation.
// Watching the attribute also catches the controller closing the menu on resize.
const lockScroll = () => document.documentElement.toggleAttribute('data-af-menu-open', menu.getAttribute('aria-expanded') === 'true');
new MutationObserver(lockScroll).observe(menu, { attributes: true, attributeFilter: ['aria-expanded'] });
lockScroll();

function menuOpened() {
  if (menu.getAttribute('aria-expanded') !== 'true') return;
  const current = [...nav.querySelectorAll('.af-header-group')].find((group) => group.querySelector('[aria-current="page"]'));
  current?.querySelector('button').click();
  nav.querySelector('a, button').focus();
}
// This module first runs during the opening click's import; later opens come through the listener.
menu.addEventListener('click', menuOpened);
menuOpened();

// The controller's desktop rules close a group, or the menu, when focus or the pointer leaves.
// Here the menu fills the screen, so it stays open until asked, even when its background is tapped.
for (const type of ['focusout', 'pointerleave']) {
  header.addEventListener(type, (event) => { if (compact.matches) event.stopPropagation(); }, true);
}

// Escape closes the whole menu at once, not just the open group first.
addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || menu.getAttribute('aria-expanded') !== 'true') return;
  event.stopPropagation();
  event.preventDefault();
  menu.click();
  menu.focus();
}, true);
