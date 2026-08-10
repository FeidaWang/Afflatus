const TELEMETRY_GROUPS = [
  {
    root: '#stardrive',
    values: '.strip-value',
  },
  {
    root: '#fy2026Performance .cycle-core',
    values: '.cycle-efficiency strong, .core-telemetry div > dd:first-of-type',
  },
  {
    root: '#fy2026Performance .velocity-field',
    values: '.benchmark-row strong',
  },
  {
    root: '#fy2026Performance .flight-paths',
    values: '.route-efficiency strong, .route-track b',
  },
];

function revealGroup(group) {
  if (group.classList.contains('telemetry-live')) return;
  group.classList.add('telemetry-live');
}

export function initHomeScrollTelemetry() {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const groups = TELEMETRY_GROUPS.map(({ root, values }) => {
    const group = document.querySelector(root);
    if (!group) return null;
    const elements = [...group.querySelectorAll(values)];
    if (!elements.length) return null;
    if (!reducedMotion) {
      group.classList.add('telemetry-pending');
      elements.forEach(element => element.classList.add('telemetry-value'));
    }
    return { group, elements };
  }).filter(Boolean);

  if (reducedMotion || !('IntersectionObserver' in window)) {
    groups.forEach(({ group }) => revealGroup(group));
    return null;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const record = groups.find(({ group }) => group === entry.target);
      if (!record) return;
      observer.unobserve(record.group);
      revealGroup(record.group);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -12% 0px' });
  groups.forEach(({ group }) => observer.observe(group));
  return observer;
}
