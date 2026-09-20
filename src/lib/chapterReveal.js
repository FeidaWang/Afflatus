// One-shot enhancement: markup is visible before JS, without observers and on failure.
export function initChapterReveals(root, { reduced, paused = () => false } = {}) {
  if (!window.IntersectionObserver) return { cancel() {}, destroy() {} };
  const active = new Set();
  const cancel = () => { for (const animation of active) animation.cancel(); active.clear(); };
  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(target);
      if (reduced?.matches || paused() || document.hidden || !target.animate) continue;
      const animation = target.animate([{ opacity: .82, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
      active.add(animation);
      animation.finished.then(() => active.delete(animation), () => active.delete(animation));
    }
  }, { threshold: .12 });
  for (const target of root.querySelectorAll('[data-chapter-reveal]')) {
    if (target.getBoundingClientRect().top >= innerHeight) observer.observe(target);
  }
  const preference = () => { if (reduced.matches) cancel(); };
  const visibility = () => { if (document.hidden) cancel(); };
  reduced?.addEventListener('change', preference);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', cancel);
  return { cancel, destroy() { observer.disconnect(); cancel(); reduced?.removeEventListener('change', preference); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', cancel); } };
}
