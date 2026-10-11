// Text positions survive pagination, font changes and small chapter edits.
export function createTextAnchor(text, offset = 0) {
  const index = Math.max(0, Math.min(text.length, Math.floor(offset)));
  return { offset: index, quote: text.slice(index, index + 80) };
}

export function resolveTextAnchor(text, anchor) {
  const offset = Math.max(0, Math.min(text.length, Number(anchor?.offset) || 0));
  if (!anchor?.quote || text.slice(offset, offset + anchor.quote.length) === anchor.quote) return offset;
  let found = text.indexOf(anchor.quote), closest = -1;
  while (found >= 0) {
    if (closest < 0 || Math.abs(found - offset) < Math.abs(closest - offset)) closest = found;
    found = text.indexOf(anchor.quote, found + 1);
  }
  return closest < 0 ? offset : closest;
}

export function anchorFromVisibleBlock(root, readingLine = 64) {
  if (!root) return null;
  let offset = 0;
  for (const block of root.children) {
    if (block.getBoundingClientRect().bottom > readingLine) break;
    offset += block.textContent.length;
  }
  return createTextAnchor(root.textContent, offset);
}

export function scrollToTextAnchor(root, anchor, readingLine = 64) {
  if (!root || !anchor) return;
  let offset = resolveTextAnchor(root.textContent, anchor);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (offset < node.textContent.length) {
      const range = document.createRange();
      range.setStart(node, offset);
      range.setEnd(node, Math.min(offset + 1, node.textContent.length));
      window.scrollTo({top:window.scrollY + range.getBoundingClientRect().top - readingLine, behavior:'instant'});
      return;
    }
    offset -= node.textContent.length;
  }
}
