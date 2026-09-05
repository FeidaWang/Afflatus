const COPY = {
  zh: {
    title: '航行札记', status: '本地档案 · 只读',
    position: '当前位置', elapsed: '航行时间', integrity: '档案完整性',
    close: '关闭航行札记',
    entry1Title: '参宿四辉光边缘', entry1Body: '资本不是弹药；首先要保住舰体、选择射界，然后才是开火。',
    entry2Title: '神谕拦截', entry2Body: '每一个仓位都必须有退出条件。没有退出条件的信念，只是未标价的风险。',
    entry3Title: '静默守望', entry3Body: '在信号稀薄时保持静默，比在噪声中寻找确定性更重要。',
    trigger: '航行札记'
  },
  en: {
    title: 'VOYAGE NOTES', status: 'LOCAL ARCHIVE · READ ONLY',
    position: 'POSITION', elapsed: 'ELAPSED', integrity: 'INTEGRITY',
    close: 'Close Voyage Notes',
    entry1Title: 'ALPHARD GLOWLINE', entry1Body: 'Capital is not ammunition. Preserve the hull, choose the firing lane, then commit.',
    entry2Title: 'ORACLE INTERCEPT', entry2Body: 'Every position needs an exit condition. Conviction without one is merely unpriced risk.',
    entry3Title: 'SILENT WATCH', entry3Body: 'When signal is scarce, staying quiet matters more than manufacturing certainty from noise.',
    trigger: 'VOYAGE NOTES'
  }
};

export function initVoyageLogConsole({ getLang = () => 'en', onOpen, onClose } = {}) {
  const root = document.getElementById('cicVoyageConsole');
  const trigger = document.getElementById('voyageLogToggle');
  const closeButton = document.getElementById('voyageLogClose');
  const boot = document.getElementById('voyageLogBoot');
  const status = document.getElementById('voyageLogStatus');
  if (!root || !trigger || !closeButton) return null;

  let returnFocus = trigger;

  const copy = () => COPY[getLang()] || COPY.en;
  const setLanguage = () => {
    const c = copy();
    root.querySelectorAll('[data-log-copy]').forEach((node) => {
      const key = node.dataset.logCopy;
      if (c[key]) node.textContent = c[key];
    });
    trigger.textContent = c.trigger;
    closeButton.setAttribute('aria-label', c.close);
    if (status) status.textContent = c.status;
  };

  const playBoot = () => {
    if (!boot) return;
    boot.classList.remove('play');
    void boot.offsetWidth;
    boot.classList.add('play');
  };

  const open = () => {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : trigger;
    document.body.classList.add('voyage-log-open');
    root.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    playBoot();
    onOpen?.();
    requestAnimationFrame(() => closeButton.focus({ preventScroll: true }));
  };

  const close = () => {
    if (!document.body.classList.contains('voyage-log-open')) return;
    document.body.classList.remove('voyage-log-open');
    root.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    onClose?.();
    returnFocus?.focus?.({ preventScroll: true });
  };

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (document.body.classList.contains('voyage-log-open')) close();
    else open();
  });
  closeButton.addEventListener('click', close);

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...root.querySelectorAll('button:not([disabled])')]
      .filter((node) => node.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  setLanguage();
  return { open, close, setLanguage };
}
