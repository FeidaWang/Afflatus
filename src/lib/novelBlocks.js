/* Chapter body markup shared by the build-time prerender
   (scripts/localize-site.mjs) and the client reader (src/pages/serialReader.js),
   so the reader can adopt a prerendered chapter's DOM as-is. Sys blocks render
   as a "cross-world terminal" card: a leading 【…】 becomes the title chip, the
   rest is the screen body. Styling lives in serial.css (.sys / .sys-head). */
export function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderNovelBlocks(blocks) {
  return (blocks || []).map((block, blockIndex) => {
    let text = String(block.text || '');
    const marker = ` data-reader-block="${blockIndex}" data-page-marker="block-${blockIndex}"`
      + ` data-reader-start="0" data-reader-end="${Array.from(text).length}"`;
    if (block.type === 'sys') {
      let heading = '幕间讯号';
      let bodyStart = 0;
      const match = text.match(/^【([^】]+)】\s*/);
      if (match) {
        heading = match[1];
        bodyStart = Array.from(match[0]).length;
        text = text.slice(match[0].length);
      }
      return `<div class="sys"${marker} data-reader-body-start="${bodyStart}"><div class="sys-head"><i class="sys-dot" aria-hidden="true"></i><span>系统播报 ⟨ ${escapeHtml(heading)} ⟩</span><span class="sys-tag">故事中的系统消息</span></div><div class="sys-body">${escapeHtml(text)}</div></div>`;
    }
    return `<p${marker}>${escapeHtml(text)}</p>`;
  }).join('');
}
