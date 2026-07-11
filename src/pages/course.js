/**
 * course.html page logic — three small, independent features:
 *   1. scroll progress rail (left edge)
 *   2. copy-prompt buttons (the "So you can tell AI this…" quotes)
 *   3. term chips (click → short bilingual definition popover) — Ch05 jargon
 *      (MTS / RFC / SLO) that a general reader landing on this personal page
 *      may not know.
 * No frameworks, no persisted state beyond what i18n.js already owns.
 */
(() => {
  'use strict';

  function lang() { try { return window.AfflatusI18N ? window.AfflatusI18N.get() : 'en'; } catch { return 'en'; } }
  function T(en, zh) { return lang() === 'zh' ? zh : en; }

  /* ---------- toast ---------- */
  const toastEl = document.getElementById('courseToast');
  function toast(msg, ms) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._h);
    toastEl._h = setTimeout(() => toastEl.classList.remove('show'), ms || 1800);
  }

  /* ---------- scroll progress rail ---------- */
  const rail = document.getElementById('courseProgress');
  let ticking = false;
  function updateProgress() {
    ticking = false;
    if (!rail) return;
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
    rail.style.height = pct + '%';
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); } }, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  /* ---------- copy-prompt buttons ---------- */
  document.querySelectorAll('.copy-btn[data-copy-target="prev"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = btn.previousElementSibling;
      const text = code ? code.textContent.trim() : '';
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Clipboard API unavailable (older browser / non-secure context) — the
        // task prompt is still selectable/readable text, just not auto-copied.
        toast(T('Select the text above and copy it manually.', '请手动选中上面的文字复制。'));
        return;
      }
      const original = btn.textContent;
      btn.classList.add('copied');
      btn.textContent = T('Copied ✓', '已复制 ✓');
      toast(T('Prompt copied — paste it into Claude Code.', '已复制——去 Claude Code 里粘贴试试。'));
      setTimeout(() => { btn.classList.remove('copied'); btn.textContent = original; }, 1600);
    });
  });

  /* ---------- term chips ---------- */
  const GLOSSARY = {
    mts: { en: 'Member of Technical Staff — the flat, senior-by-default engineering title used at labs like Anthropic; expects high autonomy and end-to-end ownership rather than a rigid ladder of levels.', zh: 'Member of Technical Staff——Anthropic 这类实验室使用的扁平、默认资深的工程师头衔；要求高度自治与端到端所有权，而非严格的层级晋升。' },
    rfc: { en: 'A one-page document written before a non-trivial change: problem, plan, alternatives, risk, rollback. Forces the thinking to happen before the code.', zh: '在做非小改动前先写的一页文档：问题、方案、备选、风险、回滚。逼着思考在写代码之前发生。' },
    slo: { en: 'Service-Level Objective — a target you commit to for a system you run (e.g. uptime, page-load time), checked on a schedule rather than only noticed after it breaks.', zh: 'Service-Level Objective（服务水平目标）——你为自己运营的系统定的目标（如可用性、加载时间），按周期检查，而不是等它坏了才发现。' },
  };
  const popover = document.getElementById('termPopover');
  let openChip = null;

  function closePopover() {
    if (!popover) return;
    popover.hidden = true;
    openChip = null;
  }
  function openPopover(chip) {
    if (!popover) return;
    const key = chip.dataset.term;
    const entry = GLOSSARY[key];
    if (!entry) return;
    popover.textContent = T(entry.en, entry.zh);
    popover.hidden = false;
    const r = chip.getBoundingClientRect();
    const pw = popover.offsetWidth || 260;
    let left = r.left;
    if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
    popover.style.left = Math.max(12, left) + 'px';
    popover.style.top = (r.bottom + 8) + 'px';
    openChip = chip;
  }
  document.addEventListener('click', (e) => {
    const chip = e.target.closest && e.target.closest('.term-chip');
    if (chip) {
      e.stopPropagation();
      if (openChip === chip) closePopover(); else openPopover(chip);
      return;
    }
    if (openChip && !(popover && popover.contains(e.target))) closePopover();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopover(); });
  window.addEventListener('scroll', closePopover, { passive: true });
  window.addEventListener('resize', closePopover);
  // Re-render an open popover's text if the language toggles mid-read.
  window.addEventListener('afflatus-lang', () => { if (openChip) openPopover(openChip); });
})();
