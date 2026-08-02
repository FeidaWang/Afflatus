const COPY = {
  zh: {
    title: '私人航海日志', locked: '需要身份认证', unlocked: '隔离档案已解锁',
    position: '当前位置', elapsed: '航行时间', integrity: '档案完整性',
    intro: '舰长日志与资产纪律记录位于隔离链路之后。认证只在当前设备会话内有效。',
    account: '账户', password: '密码', authenticate: '认证并进入', close: '关闭私人航海日志',
    entry1Title: '参宿四辉光边缘', entry1Body: '资本不是弹药；首先要保住舰体、选择射界，然后才是开火。',
    entry2Title: '神谕拦截', entry2Body: '每一个仓位都必须有退出条件。没有退出条件的信念，只是未标价的风险。',
    entry3Title: '静默守望', entry3Body: '在信号稀薄时保持静默，比在噪声中寻找确定性更重要。',
    trigger: '私人日志'
  },
  en: {
    title: 'PRIVATE VOYAGE LOG', locked: 'IDENTITY REQUIRED', unlocked: 'AIR-GAPPED ARCHIVE UNLOCKED',
    position: 'POSITION', elapsed: 'ELAPSED', integrity: 'INTEGRITY',
    intro: 'The captain’s log and capital-discipline record sit behind an air-gapped link. Access lasts for this device session only.',
    account: 'ACCOUNT', password: 'PASSWORD', authenticate: 'AUTHENTICATE', close: 'Close Private Voyage Log',
    entry1Title: 'ALPHARD GLOWLINE', entry1Body: 'Capital is not ammunition. Preserve the hull, choose the firing lane, then commit.',
    entry2Title: 'ORACLE INTERCEPT', entry2Body: 'Every position needs an exit condition. Conviction without one is merely unpriced risk.',
    entry3Title: 'SILENT WATCH', entry3Body: 'When signal is scarce, staying quiet matters more than manufacturing certainty from noise.',
    trigger: 'PRIVATE LOG'
  }
};

export function initVoyageLogConsole({ getLang = () => 'en', onOpen, onClose } = {}) {
  const root = document.getElementById('cicVoyageConsole');
  const trigger = document.getElementById('voyageLogToggle');
  const closeButton = document.getElementById('voyageLogClose');
  const form = document.getElementById('voyageAccessForm');
  const boot = document.getElementById('voyageLogBoot');
  const entries = document.getElementById('voyageLogEntries');
  const status = document.getElementById('voyageLogStatus');
  if (!root || !trigger || !closeButton || !form) return null;

  let unlocked = false;
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
    if (status) status.textContent = unlocked ? c.unlocked : c.locked;
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
    requestAnimationFrame(() => (unlocked ? closeButton : document.getElementById('voyageAccount'))?.focus({ preventScroll: true }));
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

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    unlocked = true;
    root.classList.add('is-unlocked');
    entries?.setAttribute('aria-hidden', 'false');
    if (status) status.textContent = copy().unlocked;
    playBoot();
    requestAnimationFrame(() => closeButton.focus({ preventScroll: true }));
  });

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...root.querySelectorAll('button:not([disabled]), input:not([disabled])')]
      .filter((node) => node.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  setLanguage();
  return { open, close, setLanguage };
}
