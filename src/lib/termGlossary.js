/* ============================================================
   Shared term-glossary tooltip (U46 46-乙-① 术语渐进披露).
   - TERMS: pure bilingual data registry, one line of plain-language
     explanation per jargon term. Vitest-checked for bilingual
     completeness in tests/termGlossary.test.js.
   - mountTermGlossary(): DOM glue, not unit-tested (repo convention:
     数据/数学层测试，渲染胶水层不测). Wires a single delegated click
     handler for any `.term` button on the page, a shared singleton
     popover, and Escape/outside-click/scroll/resize dismissal.
     Buttons are native <button type="button"> so click and
     Enter/Space activation are both free (22c: no hover-only info).
   ============================================================ */

export const TERMS = {
  sharpe: {
    en: 'Return earned per unit of risk taken; above 1 is solid.',
    zh: '每承担一份风险换到的回报；大于 1 算不错。',
  },
  drawdown: {
    en: 'The biggest drop from a peak to the lowest point after it, before recovering.',
    zh: '从最高点回落到之后最低点的最大跌幅，回本前的谷底。',
  },
  beta: {
    en: 'How much a portfolio moves relative to the market; 1.0 tracks it exactly, above 1 amplifies swings.',
    zh: '相对大盘的波动幅度；1.0 与大盘同步，大于 1 意味着涨跌被放大。',
  },
  keter: {
    en: 'SCP-speak for "hardest to contain" — here: highest market impact.',
    zh: 'SCP 用语「最难收容」——在本站指对市场冲击最大的一档。',
  },
  sep: {
    en: 'The Fed’s Summary of Economic Projections, released quarterly — includes the "dot plot" of rate expectations.',
    zh: '美联储经济预测摘要（SEP），每季度发布一次——包含利率预期的"点阵图"。',
  },
  brier: {
    en: 'Prediction accuracy score, 0 (perfect) to 1 (worst).',
    zh: '预测准确度评分，0 最好 1 最差。',
  },
  bootstrap: {
    en: 'A resampling technique — redraw the same data with replacement thousands of times to see how stable a result is.',
    zh: '一种重采样技术——对同一批数据反复有放回抽样上千次，看结果有多稳。',
  },
};

/**
 * Wire up delegated click handling for `<button class="term" data-term="…">`
 * anywhere on the page, plus a shared singleton `#termPopover`.
 * @param {{getLang?: () => 'en'|'zh'}} [opts]
 * @returns {{refresh: () => void, close: () => void}}
 */
export function mountTermGlossary(opts = {}) {
  const getLang = opts.getLang || (() => 'en');
  let popover = document.getElementById('termPopover');
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'termPopover';
    popover.className = 'termTip';
    popover.setAttribute('role', 'tooltip');
    popover.hidden = true;
    document.body.appendChild(popover);
  }
  let openBtn = null;

  function close() {
    popover.hidden = true;
    openBtn = null;
  }
  function open(btn) {
    const entry = TERMS[btn.dataset.term];
    if (!entry) return;
    popover.textContent = getLang() === 'zh' ? entry.zh : entry.en;
    popover.hidden = false;
    const r = btn.getBoundingClientRect();
    const pw = popover.offsetWidth || 260;
    let left = r.left;
    if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
    popover.style.left = Math.max(12, left) + 'px';
    popover.style.top = r.bottom + 8 + 'px';
    openBtn = btn;
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.term');
    if (btn) {
      e.stopPropagation();
      if (openBtn === btn) close(); else open(btn);
      return;
    }
    if (openBtn && !popover.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('scroll', close, { passive: true });
  window.addEventListener('resize', close);

  return {
    refresh: () => { if (openBtn) open(openBtn); },
    close,
  };
}
