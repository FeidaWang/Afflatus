import './mediaCompare.css';

// Native range keyboard semantics; without JS both complete images stay visible.
export function initMediaComparisons(root = document) {
  const disposers = [];
  for (const host of root.querySelectorAll('[data-media-compare]')) {
    const images = host.querySelector('.media-compare-images');
    const controls = host.querySelector('.media-compare-controls');
    const range = host.querySelector('input[type="range"]');
    const toggle = host.querySelector('[data-compare-toggle]');
    const value = host.querySelector('output');
    const update = () => {
      const position = Math.min(100, Math.max(0, Number(range.value)));
      images.style.setProperty('--compare-position', `${position}%`);
      value.value = `${position}%`;
    };
    const switchMode = () => {
      const comparing = images.classList.toggle('is-comparing');
      toggle.setAttribute('aria-pressed', String(comparing));
      host.querySelector('.media-compare-range').hidden = !comparing;
      update();
    };
    range.addEventListener('input', update);
    toggle.addEventListener('click', switchMode);
    controls.hidden = false;
    update();
    disposers.push(() => { range.removeEventListener('input', update); toggle.removeEventListener('click', switchMode); images.classList.remove('is-comparing'); controls.hidden = true; });
  }
  return () => disposers.forEach(dispose => dispose());
}
