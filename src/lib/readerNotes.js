// A small, deliberately conservative first glossary. These labels classify
// terms; the explanation is the currently visible source paragraph itself.
// No later chapter, unseen paragraph, or model-generated lore is consulted.
const TERMS = [
  { word:'枯咬藤', from:2, kind:'本章出现的植物名称' },
  { word:'看守人', from:1, kind:'故事中的身份称谓' },
  { word:'归墟', from:1, kind:'故事中的系统名称' },
  { word:'母树', from:2, kind:'故事中的植物称谓' },
];

export function mountReaderNotes({ getBookId, getChapter }) {
  const dialog = document.getElementById('readerNoteDialog');
  const root = document.getElementById('chapterBody');
  return {
    decorate() {
      if (!root || getBookId() !== 'wanjie-zhongchun') return;
      const chapter = getChapter();
      if (!chapter) return;
      for (const term of TERMS) {
        if (Number(chapter.id) < term.from || root.querySelector(`[data-reader-term="${term.word}"]`)) continue;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          if (node.parentElement.closest('button, .sys-head')) continue;
          const index = node.textContent.indexOf(term.word);
          if (index < 0) continue;
          const paragraph = node.parentElement.closest('p, .sys-body');
          if (!paragraph) continue;
          const context = paragraph.textContent;
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'reader-term';
          button.dataset.readerTerm = term.word;
          button.textContent = term.word;
          button.setAttribute('aria-label', `查看${term.word}的当前页注释`);
          button.addEventListener('click', () => {
            document.getElementById('readerNoteTitle').textContent = term.word;
            document.getElementById('readerNoteKind').textContent = term.kind;
            document.getElementById('readerNoteQuote').textContent = context.length > 92 ? context.slice(0, 92) + '…' : context;
            document.getElementById('readerNoteSource').textContent = `正文依据 · ${chapter.title} · 当前页`;
            dialog.showModal();
          });
          const text = node.textContent;
          node.replaceWith(document.createTextNode(text.slice(0,index)), button, document.createTextNode(text.slice(index+term.word.length)));
          break;
        }
      }
    },
  };
}
