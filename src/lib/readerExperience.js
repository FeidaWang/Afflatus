export function mountReaderExperience({ store, getNovel, getChapter, getPage, onContinue, onLibrary, onBookmark, onTypography }) {
  const $ = (id) => document.getElementById(id);
  const dialogs = [...document.querySelectorAll('dialog.reader-dialog')];
  const openDialog = (id) => { dialogs.forEach((dialog) => dialog.close()); $(id).showModal(); };
  document.querySelectorAll('[data-reader-dialog]').forEach((button) => button.addEventListener('click', () => openDialog(button.dataset.readerDialog)));
  dialogs.forEach((dialog) => {
    dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientY < rect.top || event.clientX < rect.left || event.clientX > rect.right) dialog.close();
    });
  });
  $('continueReading').addEventListener('click', onContinue);
  $('readerBack').addEventListener('click', onLibrary);
  $('libraryTheme').addEventListener('click', () => {
    const next = store.getState().theme === 'night' ? 'paper' : 'night';
    document.querySelector(`.swatch[data-theme="${next}"]`).click();
    sync();
  });
  $('resumeBookmarks').addEventListener('click', () => { renderBookmarks(); openDialog('bookmarksDialog'); });
  $('readerBookmarks').addEventListener('click', () => { renderBookmarks(); openDialog('bookmarksDialog'); });
  $('readerLineHeight').value = store.getState().lineHeight;
  const applyTypography = () => {
    document.documentElement.style.setProperty('--read-lh', store.getState().lineHeight);
    $('fontSizeValue').textContent = store.getState().fontSize + 'px';
    $('readerLineHeightValue').textContent = store.getState().lineHeight.toFixed(2);
  };
  $('readerLineHeight').addEventListener('input', () => {
    store.update({ lineHeight: Number($('readerLineHeight').value) });
    applyTypography(); onTypography();
  });
  $('readerMotion').value = store.getState().motion;
  $('bookStage').dataset.motion = store.getState().motion;
  $('readerMotion').addEventListener('change', () => { $('bookStage').dataset.motion = $('readerMotion').value; store.update({motion:$('readerMotion').value}); });
  applyTypography();
  store.subscribe(() => { applyTypography(); sync(); });

  function renderBookmarks() {
    const list = $('savedBookmarks');
    list.replaceChildren();
    const entries = [...store.getState().savedBookmarks].reverse();
    $('bookmarksEmpty').hidden = entries.length > 0;
    for (const entry of entries) {
      const button = document.createElement('button');
      button.className = 'saved-bookmark';
      const title = document.createElement('strong');
      title.textContent = entry.chapterTitle;
      const text = document.createElement('span');
      text.textContent = entry.anchor?.quote || '已保存的阅读位置';
      button.append(title, text);
      button.addEventListener('click', () => { $('bookmarksDialog').close(); onBookmark(entry); });
      list.append(button);
    }
  }

  function sync() {
    const novel = getNovel(), chapter = getChapter();
    if (!novel || !chapter) return;
    const saved = store.getState();
    const page = getPage();
    $('resumeTitle').textContent = novel.novel.title;
    $('resumeAuthor').textContent = novel.novel.author;
    $('resumeChapter').textContent = chapter.title;
    const chapterIndex = novel.chapters.findIndex((item) => item.id === chapter.id);
    const position = saved.positions[novel.id];
    const anchor = page?.anchor || (String(position?.chapterId) === String(chapter.id) ? position.anchor : null);
    // From the build-split table of contents; the body may not be loaded yet.
    const length = chapter.textLength || 0;
    const fraction = anchor ? Math.min(1, anchor.offset / Math.max(1, length)) : 0;
    const progress = Math.round(100 * (chapterIndex + fraction) / novel.chapters.length);
    $('resumeProgress').value = progress;
    $('resumePosition').textContent = `第 ${chapterIndex + 1} / ${novel.chapters.length} 章 · 已读约 ${progress}%`;
    $('resumeBookmarksCount').textContent = saved.savedBookmarks.length ? `${saved.savedBookmarks.length} 条` : '收藏你的片刻';
    $('readerBookName').textContent = novel.novel.title;
    $('readerSaveStatus').textContent = store.isPersisted() ? '阅读位置自动保存' : '仅本次保留 · 浏览器存储不可用';
    $('libraryTheme').setAttribute('aria-label', saved.theme === 'night' ? '切换日间模式' : '切换夜间模式');
    $('libraryTheme').setAttribute('aria-pressed', String(saved.theme === 'night'));
  }
  return { sync, setView(view) { document.body.dataset.readerView = view; document.getElementById('chapterTitle').setAttribute('aria-level', view === 'reading' ? '1' : '2'); sync(); } };
}
