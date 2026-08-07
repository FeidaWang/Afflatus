import { animateCountUp } from './viz.js';

const TELEMETRY_GROUPS = [
  {
    root: '#stardrive',
    values: '.strip-value',
  },
  {
    root: '#fy2026Performance',
    values: [
      '.realized-profit strong',
      '.ledger-metrics dd',
      '.return-stack article > strong',
      '.benchmark-row strong',
      '.route-efficiency strong',
      '.route-track b',
      '.risk-grid strong',
    ].join(','),
  },
];

function parseDisplayValue(element) {
  const source = element.textContent?.trim() || '';
  const match = source.match(/^([\s\S]*?)([+\-−]?)(\d+(?:\.\d+)?)([\s\S]*)$/u);
  if (!match) return null;
  const [, prefix, sign, digits, suffix] = match;
  const decimals = digits.includes('.') ? digits.split('.')[1].length : 0;
  const integerDigits = digits.split('.')[0];
  const integerWidth = /^0\d/u.test(integerDigits) ? integerDigits.length : 0;
  const target = Number.parseFloat(digits);
  if (!Number.isFinite(target)) return null;
  return {
    target,
    format(value) {
      const numeric = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
      const [integer, fraction] = numeric.split('.');
      const padded = integerWidth ? integer.padStart(integerWidth, '0') : integer;
      return `${prefix}${sign}${padded}${fraction == null ? '' : `.${fraction}`}${suffix}`;
    },
  };
}

function revealGroup(group, values) {
  if (group.classList.contains('telemetry-live')) return;
  group.classList.add('telemetry-live');
  values.forEach(({ element, model }, index) => {
    window.setTimeout(() => {
      animateCountUp(null, model.target, {
        duration: 950 + Math.min(index, 8) * 70,
        onFrame: value => { element.textContent = model.format(value); },
      });
    }, Math.min(index, 10) * 45);
  });
}

export function initHomeScrollTelemetry() {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const groups = TELEMETRY_GROUPS.map(({ root, values }) => {
    const group = document.querySelector(root);
    if (!group) return null;
    const elements = [...group.querySelectorAll(values)]
      .map(element => ({ element, model: parseDisplayValue(element) }))
      .filter(({ model }) => model);
    if (!elements.length) return null;
    if (!reducedMotion) {
      group.classList.add('telemetry-pending');
      elements.forEach(({ element, model }) => {
        element.dataset.telemetryFinal = element.textContent.trim();
        element.textContent = model.format(0);
      });
    }
    return { group, elements };
  }).filter(Boolean);

  if (reducedMotion || !('IntersectionObserver' in window)) {
    groups.forEach(({ group, elements }) => revealGroup(group, elements));
    return null;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const record = groups.find(({ group }) => group === entry.target);
      if (!record) return;
      observer.unobserve(record.group);
      revealGroup(record.group, record.elements);
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -10% 0px' });
  groups.forEach(({ group }) => observer.observe(group));
  return observer;
}
