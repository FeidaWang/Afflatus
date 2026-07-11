/**
 * course.html page logic — three small, independent features:
 *   1. scroll progress rail (left edge)
 *   2. copy-prompt buttons (Module 1's "try it now" tasks)
 *   3. depth-capsule term chips (click → short bilingual definition popover)
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

  /* ---------- depth-capsule term chips ---------- */
  const GLOSSARY = {
    agent: { en: 'A program that can read/write files, run commands and call tools on its own — not just answer in a chat box.', zh: '能自己读写文件、执行命令、调用工具的程序——不只是在聊天框里回答问题。' },
    diff: { en: "The exact lines an AI change adds or removes. Reviewing means judging the diff's behavior, not reading every character.", zh: '一次 AI 改动具体新增/删除了哪些行。审查审的是这次改动的行为，不是逐字阅读。' },
    context: { en: "Everything a model currently has loaded — your files, this conversation, any attached docs. It has a limit; long chats crowd out useful file content.", zh: '模型当下加载的一切——你的文件、这段对话、附带的文档。它有上限；对话太长会挤占有用的文件内容。' },
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
