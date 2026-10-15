/* Serial reader controller. Moved out of serial.html so the ~450 generated
   novel pages share one cached, minified module instead of each inlining
   ~46 KB of script. */
import { fetchJson, purgeCachedJson } from '../lib/fetchJson.js';
import { escapeHtml } from '../lib/escapeHtml.js';
let renderNovelBlocks;
import { mountReaderExperience } from '../lib/readerExperience.js';
import {
  createReaderStore,
  createStorageAdapter,
} from '../lib/readerStore.js';
import {
  chapterIdEquals,
  parseReaderPath,
  readerLocale,
  readerPath,
} from '../lib/serialRoutes.js';

export function mountSerialReader() {
  var reader = document.getElementById('reader');
  document.body.dataset.readerReady = 'false';
  var state = {
    data:null, novels:[], novelId:null, novelIdx:0, chapters:[], idx:0,
    autoTimer:0, waterfall:false, wfIndex:0, lang:'zh'
  };
  var serialApi = {
    chapterIdEquals:chapterIdEquals, createPagedBook:null,
    mountReaderExperience:mountReaderExperience,
    anchorFromVisibleBlock:null, scrollToTextAnchor:null,
    createReaderStore:createReaderStore,
    createStorageAdapter:createStorageAdapter, parseReaderPath:parseReaderPath,
    readerLocale:readerLocale, readerPath:readerPath
  };
  var readerStore = null, pagedBook = null, narrationPlayer = null, experience = null, readerNotes = null;
  var bootStarted = false;
  // A chapter page ships its body prerendered with renderNovelBlocks markup;
  // adopt it as that chapter's content instead of downloading it again.
  var prerenderedChapter = (function () {
    var route = parseReaderPath(location.pathname);
    if (document.getElementById('readerNormal').dataset.prerendered !== 'chapter' || !route || route.chapterId == null) return null;
    return { bookId:route.bookId, chapterId:route.chapterId, html:document.getElementById('chapterBody').innerHTML };
  })();
  var initialMetadata = {
    path:location.pathname, title:document.title,
    nodes:Array.from(document.querySelectorAll('link[rel="canonical"], meta[name="description"], meta[property^="og:"]')).map(function (node) {
      var attr = node.tagName === 'LINK' ? 'href' : 'content';
      return { node:node, attr:attr, value:node.getAttribute(attr) };
    })
  };
  function isZh() { return (document.documentElement.lang || '').toLowerCase().startsWith('zh'); }
  function T(en, zh) { return isZh() ? zh : en; }
  // Schedule the core reader before optional control wiring below. A missing
  // decorative/FAB element must not prevent chapter loading.
  window.setTimeout(boot, 0);
  function currentPageIndex() {
    return pagedBook ? pagedBook.getState().pageIndex : 0;
  }
  function currentWaterfallOffset() {
    var section = document.querySelector('#waterfallList .wf-chapter[data-idx="' + state.idx + '"]');
    if (!section) return 0;
    var sectionTop = section.getBoundingClientRect().top + window.scrollY;
    return Math.max(0, Math.round(window.scrollY - sectionTop));
  }
  function currentReadingOffset() {
    return state.waterfall ? currentWaterfallOffset() : currentPageIndex();
  }
  function restoredPage(value) {
    var page = Number(value);
    return Number.isInteger(page) && page >= 0 && page < 500 ? page : 0;
  }

  function currentReadingAnchor() {
    if (!serialApi) return null;
    if (!state.waterfall) return pagedBook ? pagedBook.getState().anchor : null;
    var root = document.querySelector('#waterfallList .wf-chapter[data-idx="' + state.idx + '"] .body');
    return serialApi.anchorFromVisibleBlock(root);
  }
  function readerState() {
    return readerStore ? readerStore.getState() : {
      theme:'green', fontSize:18, bookId:null, chapterId:null, offset:0,
      layout:'book', bookmarks:{}, visited:{}, audioTrack:0,
      narration:{ rate:1, positions:{} }
    };
  }
  function syncReaderMetadata(chapterId) {
    if (!serialApi || !state.novelId) return;
    var currentNovel = state.novels[state.novelIdx];
    if (!currentNovel || !currentNovel.novel) return;
    var chapter = state.chapters.find(function (item) {
      return serialApi.chapterIdEquals(item.id, chapterId);
    });
    if (!chapter) return;
    var locale = serialApi.readerLocale(
      location.pathname,
      document.documentElement.dataset.afflatusLocale
    );
    var path = serialApi.readerPath({ locale:locale, bookId:state.novelId, chapterId:chapter.id });
    var canonicalUrl = 'https://feida.au' + path;
    var title = chapter.title + ' — 《' + currentNovel.novel.title + '》· Project Afflatus';
    var description = '原创中文连载《' + currentNovel.novel.title + '》' + chapter.title + '，护眼阅读。';
    document.title = title;
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', canonicalUrl);
    [
      ['meta[name="description"]', description],
      ['meta[property="og:title"]', title],
      ['meta[property="og:description"]', description],
      ['meta[property="og:url"]', canonicalUrl],
      ['meta[property="og:type"]', 'article']
    ].forEach(function (entry) {
      var node = document.querySelector(entry[0]);
      if (node) node.setAttribute('content', entry[1]);
    });
  }
  function syncLibraryMetadata() {
    var title = '故事 — 原创中文连载 · AFFLATUS';
    document.title = title;
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = 'https://feida.au/zh/serial.html';
    [['og:title', title], ['og:url', 'https://feida.au/zh/serial.html'], ['og:type', 'website']].forEach(function (entry) {
      var node = document.querySelector('meta[property="' + entry[0] + '"]');
      if (node) node.content = entry[1];
    });
  }
  function syncReaderUrl(chapterId, mode) {
    if (!serialApi || !state.novelId) return;
    var currentRoute = serialApi.parseReaderPath(location.pathname);
    var preserveLanding = mode === 'none' && (!currentRoute || currentRoute.chapterId == null);
    if (preserveLanding && location.pathname === initialMetadata.path) {
      document.title = initialMetadata.title;
      initialMetadata.nodes.forEach(function (entry) { entry.node.setAttribute(entry.attr, entry.value); });
    } else if (!preserveLanding) syncReaderMetadata(chapterId);
    if (mode === 'none') return;
    var locale = serialApi.readerLocale(
      location.pathname,
      document.documentElement.dataset.afflatusLocale
    );
    var path = serialApi.readerPath({ locale:locale, bookId:state.novelId, chapterId:chapterId });
    if (mode === 'push') {
      var previous = history.state && history.state.bookId ? history.state : readerState();
      history.replaceState({
        bookId:currentRoute ? currentRoute.bookId : previous.bookId,
        chapterId:currentRoute && currentRoute.chapterId != null ? currentRoute.chapterId : previous.chapterId,
        offset:Math.max(0, Math.round(previous.offset || 0)),
        layout:previous.layout || readerState().layout
      }, '', location.href);
    }
    if (location.pathname === path) {
      history.replaceState({
        bookId:state.novelId,
        chapterId:chapterId,
        offset:currentReadingOffset(),
        layout:state.waterfall ? 'waterfall' : 'book'
      }, '', location.href);
      return;
    }
    history[mode === 'push' ? 'pushState' : 'replaceState'](
      { bookId:state.novelId, chapterId:chapterId, offset:0, layout:state.waterfall ? 'waterfall' : 'book' },
      '',
      path + location.search + location.hash
    );
  }

  /* The landing header scrolls away; only the reader toolbar is sticky. Its
     height still varies across widths, so keep downstream offsets live. */
  var toolbarEl = document.getElementById('toolbar');
  function syncToolbarH() {
    document.documentElement.style.setProperty('--toolbar-h', toolbarEl.offsetHeight + 'px');
  }
  syncToolbarH();
  window.addEventListener('resize', syncToolbarH);
  if (window.ResizeObserver) {
    var toolbarResizeObserver = new ResizeObserver(syncToolbarH);
    toolbarResizeObserver.observe(toolbarEl);
  }

  function toast(msg, ms) {
    var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, ms || 2200);
  }

  /* ---------- theme ---------- */
  function applyTheme(name) {
    reader.setAttribute('data-theme', name);
    document.body.dataset.readerTheme = name;
    document.querySelectorAll('.swatch').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.theme === name)); });
    document.querySelectorAll('.swatch').forEach(function (b) { b.classList.toggle('on', b.dataset.theme === name); });
    if (readerStore) readerStore.update({ theme:name });
  }
  document.querySelectorAll('.swatch').forEach(function (b) { b.addEventListener('click', function () { applyTheme(b.dataset.theme); }); });

  /* ---------- font size ---------- */
  function applyFs(px) {
    px = Math.max(16, Math.min(28, px));
    document.documentElement.style.setProperty('--read-fs', px + 'px');
    if (readerStore) readerStore.update({ fontSize:px });
    if (pagedBook && !state.waterfall) window.setTimeout(function () { pagedBook.repaginate(); }, 0);
    return px;
  }
  var curFs = 18;
  document.getElementById('fsMinus').addEventListener('click', function () { curFs = applyFs(curFs - 1); });
  document.getElementById('fsPlus').addEventListener('click', function () { curFs = applyFs(curFs + 1); });

  /* ---------- TOC drawer ---------- */
  var drawer = document.getElementById('tocDrawer'), backdrop = document.getElementById('tocBackdrop');
  var mainWrap = document.querySelector('main.wrap');
  var tocTriggers = [document.getElementById('tocOpen'), document.getElementById('fabToc')];
  var lastTocTrigger = null;
  function drawerFocusables() {
    return Array.from(drawer.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
  }
  function openDrawer(event) {
    lastTocTrigger = event && event.currentTarget ? event.currentTarget : document.activeElement;
    drawer.inert = false;
    drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.add('open');
    backdrop.classList.add('open');
    if (mainWrap) mainWrap.inert = true;
    document.getElementById('afflatus-header').inert = true;
    document.body.classList.add('toc-open');
    tocTriggers.forEach(function (trigger) { trigger.setAttribute('aria-expanded', 'true'); });
    window.requestAnimationFrame(function () { document.getElementById('tocClose').focus(); });
  }
  function closeDrawer(options) {
    var restoreFocus = !options || options.restoreFocus !== false;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    backdrop.classList.remove('open');
    if (mainWrap) mainWrap.inert = false;
    document.getElementById('afflatus-header').inert = false;
    document.body.classList.remove('toc-open');
    tocTriggers.forEach(function (trigger) { trigger.setAttribute('aria-expanded', 'false'); });
    if (restoreFocus && lastTocTrigger && document.contains(lastTocTrigger)) lastTocTrigger.focus();
  }
  tocTriggers.forEach(function (trigger) { trigger.addEventListener('click', openDrawer); });
  document.getElementById('tocClose').addEventListener('click', function () { closeDrawer(); });
  backdrop.addEventListener('click', function () { closeDrawer(); });
  document.addEventListener('keydown', function (event) {
    if (!drawer.classList.contains('open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== 'Tab') return;
    var focusables = drawerFocusables();
    if (!focusables.length) return;
    var first = focusables[0], last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  function visitedSet() { return new Set((readerState().visited || {})[state.novelId] || []); }
  function markVisited(id) { if (readerStore && state.novelId) readerStore.markVisited(state.novelId, id); }

  function renderToc() {
    var list = document.getElementById('tocList'); list.innerHTML = '';
    var curNovel = state.novels[state.novelIdx];
    var updateNote = (curNovel && curNovel.novel.updateNote) || '连载更新';
    document.getElementById('tocNote').textContent = '共 ' + state.chapters.length + ' 章 · ' + updateNote;
    var visited = visitedSet();
    var bm = getBookmark();
    updateBookmarkBtn(bm);
    state.chapters.forEach(function (c, i) {
      var b = document.createElement('a');
      b.href = serialApi.readerPath({ locale:serialApi.readerLocale(location.pathname, document.documentElement.dataset.afflatusLocale), bookId:state.novelId, chapterId:c.id });
      if (i === state.idx) b.setAttribute('aria-current', 'page');
      b.className = 'toc-item' + (i === state.idx ? ' current' : '');
      b.innerHTML = '<span class="t">' + (visited.has(c.id) ? '' : '● ') + escapeHtml(c.title) + '</span><span class="wc">' +
        (c.wordCount || '') + '字' +
        (bm && bm.chapterId === c.id ? ' <span class="bk">☆</span>' : '') + '</span>';
      b.addEventListener('click', function (event) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        closeDrawer({ restoreFocus:false });
        goToChapter(i, true);
        document.getElementById(state.waterfall ? 'readerWaterfall' : 'bookStage').focus({ preventScroll:true });
      });
      list.appendChild(b);
    });
  }

  /* ---------- bookmark ----------
     U15d: bookmark now records the chapter title so the toolbar button
     itself shows what's saved (station-master's minimal-scope call: one
     bookmark per novel, not a managed list). */
  function getBookmark() { return (readerState().bookmarks || {})[state.novelId] || null; }
  function truncateTitle(s, n) { return s && s.length > n ? s.slice(0, n) + '…' : (s || ''); }
  function updateBookmarkBtn(bm) {
    var btn = document.getElementById('bookmarkBtn');
    btn.setAttribute('aria-label', bm ? '保存当前位置为新书签（已有书签）' : '保存当前位置为书签');
    btn.setAttribute('aria-pressed', String(!!bm));
    btn.classList.toggle('is-saved', !!bm);
  }
  function setBookmark() {
    var c = state.chapters[state.idx];
    var bm = {
      chapterId: c.id,
      chapterTitle: c.title,
      offset: currentReadingOffset(),
      anchor: currentReadingAnchor(),
      updatedAt: Date.now()
    };
    if (readerStore) readerStore.setBookmark(state.novelId, bm);
    toast(readerStore && readerStore.isPersisted() ? '已保存书签：' + c.title : '本次已标记；浏览器存储不可用');
    renderToc();
  }
  function goBookmark() {
    var bm = getBookmark();
    if (!bm) { toast('还没有书签，先在想要标记的地方点一下「书签」吧'); return; }
    var i = state.chapters.findIndex(function (c) { return serialApi.chapterIdEquals(c.id, bm.chapterId); });
    if (i < 0) { toast('书签指向的章节不存在了'); return; }
    document.getElementById('bookmarksDialog').close();
    selectNovel(state.novelIdx, true, bm.chapterId, 'push', bm.offset, bm.anchor);
    toast('已跳转到书签位置');
  }
  document.getElementById('bookmarkBtn').addEventListener('click', setBookmark);
  document.getElementById('fabBookmarkGo').addEventListener('click', goBookmark);
  document.getElementById('readingBookmarkGo').addEventListener('click', goBookmark);

  /* ---------- reading progress (per-chapter + persisted "continue reading") ---------- */
  function persistProgress(offset) {
    if (!state.chapters.length || document.body.dataset.readerView !== 'reading') return;
    var chapterId = state.chapters[state.idx].id;
    offset = Math.max(0, Math.round(offset));
    if (readerStore) readerStore.setProgress(state.novelId, chapterId, offset, currentReadingAnchor());
    var route = serialApi && serialApi.parseReaderPath(location.pathname);
    if (route && route.bookId === state.novelId && serialApi.chapterIdEquals(route.chapterId, chapterId)) {
      history.replaceState({
        bookId:state.novelId,
        chapterId:chapterId,
        offset:offset,
        anchor:currentReadingAnchor(),
        layout:state.waterfall ? 'waterfall' : 'book'
      }, '', location.href);
    }
  }
  function saveProgress() { persistProgress(currentReadingOffset()); }
  var progressSaveTimer = 0, scrollFrame = 0;
  window.addEventListener('scroll', function () {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(function () {
      scrollFrame = 0;
      updateProgressBar();
      clearTimeout(progressSaveTimer);
      progressSaveTimer = setTimeout(saveProgress, 400);
    });
  }, { passive: true });
  window.addEventListener('pagehide', saveProgress);

  function updateProgressBar() {
    if (state.waterfall) {
      var section = document.querySelector('#waterfallList .wf-chapter[data-idx="' + state.idx + '"]');
      var chapterProgress = 0;
      if (section) {
        var rect = section.getBoundingClientRect();
        chapterProgress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
      }
      var waterfallPct = state.chapters.length
        ? Math.min(100, ((state.idx + chapterProgress) / state.chapters.length) * 100)
        : 0;
      document.getElementById('progressBar').style.width = waterfallPct + '%';
      return;
    }
    var page = pagedBook ? pagedBook.getState() : { pageIndex:0, pageCount:1 };
    var chapterProgress = (page.pageIndex + 1) / Math.max(1, page.pageCount);
    var pct = state.chapters.length
      ? Math.min(100, ((state.idx + chapterProgress) / state.chapters.length) * 100)
      : 0;
    document.getElementById('progressBar').style.width = pct + '%';
  }

  /* ---------- chapter data: table of contents first, bodies on demand ---------- */
  var NOVEL_TIMEOUT_MS = 20000;
  var chapterLoadSeq = 0;
  function chapterReady(bookId, c) {
    if (c.html != null || c.blocks) return true;
    if (prerenderedChapter && prerenderedChapter.bookId === bookId &&
        serialApi.chapterIdEquals(prerenderedChapter.chapterId, c.id)) {
      c.html = prerenderedChapter.html;
      return true;
    }
    return false;
  }
  function ensureChapter(bookId, c) {
    if (chapterReady(bookId, c)) return Promise.resolve(c);
    if (!c.loading) {
      c.loading = fetchJson('novel-chapter:' + bookId + ':' + c.id, { timeoutMs:NOVEL_TIMEOUT_MS })
        .then(function (data) { c.blocks = data.blocks; return c; })
        .finally(function () { c.loading = null; });
    }
    return c.loading;
  }
  function chapterHtml(c) { return c.html != null ? c.html : renderNovelBlocks(c.blocks); }
  // Runs fn now when chapter i's body is at hand, otherwise once it arrives.
  // A newer request supersedes an older one; a failed load leaves whatever
  // the reader is showing untouched and only says so in a toast.
  function withChapter(i, fn) {
    var seq = ++chapterLoadSeq, bookId = state.novelId;
    if (chapterReady(bookId, state.chapters[i])) { fn(); return; }
    var slowHint = setTimeout(function () { if (seq === chapterLoadSeq) toast('正在加载章节…', 1500); }, 400);
    ensureChapter(bookId, state.chapters[i]).then(function () {
      clearTimeout(slowHint);
      if (seq === chapterLoadSeq && bookId === state.novelId) fn();
    }, function () {
      clearTimeout(slowHint);
      if (seq === chapterLoadSeq) toast('网络不太稳定，这一章暂时没加载出来，请稍后再试', 4000);
    });
  }
  // Never replace content already on screen (a prerendered chapter or the
  // book's chapter list) with an error message; a toast is enough.
  function showLoadError() {
    toast('网络不太稳定，暂时无法读取小说数据，请稍后刷新重试', 5000);
    var body = document.getElementById('chapterBody');
    if (body.textContent.trim()) return;
    document.getElementById('chapterTitle').textContent = '内容加载失败';
    body.innerHTML = '<p>' +
      '暂时无法读取小说数据，请刷新页面重试。' +
      '</p>';
  }

  var narrationRevealVersion = 0;

  function clearNarrationHighlight() {
    document.querySelectorAll('[data-narration-active="true"]').forEach(function (node) {
      node.removeAttribute('data-narration-active');
    });
  }

  function revealNarrationCue(cue, context) {
    var revealVersion = ++narrationRevealVersion;
    clearNarrationHighlight();
    if (!cue || !context || context.bookId !== state.novelId ||
        !serialApi.chapterIdEquals(context.chapterId, state.chapters[state.idx] && state.chapters[state.idx].id)) return;
    var blockIndex = String(cue.sourceBlock);
    if (!state.waterfall && pagedBook) {
      pagedBook.revealMarker('block-' + blockIndex, {
        animate:false,
        withSound:false,
        sourceOffset:Number(cue.sourceStart) || 0
      });
    }
    requestAnimationFrame(function () {
      if (revealVersion !== narrationRevealVersion || !context ||
          context.bookId !== state.novelId ||
          !serialApi.chapterIdEquals(context.chapterId, state.chapters[state.idx] && state.chapters[state.idx].id)) return;
      var scope = document.getElementById('chapterBody');
      if (state.waterfall) {
        scope = Array.from(document.querySelectorAll('#waterfallList .wf-chapter')).find(function (section) {
          return serialApi.chapterIdEquals(section.dataset.chapterId, context.chapterId);
        });
      }
      if (!scope) return;
      var target = Array.from(scope.querySelectorAll('[data-reader-block]')).find(function (node) {
        return node.dataset.readerBlock === blockIndex;
      });
      if (!target) return;
      target.setAttribute('data-narration-active', 'true');
      if (state.waterfall) {
        var rect = target.getBoundingClientRect();
        var toolbarHeight = toolbarEl ? toolbarEl.offsetHeight : 0;
        var outOfView = rect.top < toolbarHeight + 12 || rect.bottom > window.innerHeight - 24;
        if (outOfView) {
          target.scrollIntoView({
            behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            block:'center'
          });
        }
      }
    });
  }

  function syncNarrationChapter(chapter) {
    if (!narrationPlayer || !chapter || !state.novelId) return;
    narrationPlayer.setChapter({
      bookId:state.novelId,
      chapterId:chapter.id,
      chapterIndex:state.idx,
      title:chapter.title
    });
  }

  function initNarrationPlayer() {
    var root = document.getElementById('narrationPlayer');
    if (!root || !serialApi || typeof serialApi.createNarrationPlayer !== 'function') return;
    narrationPlayer = serialApi.createNarrationPlayer({
      root:root,
      store:readerStore,
      onCueChange:revealNarrationCue,
      onPlaybackChange:function (playback) {
        if (playback.playing) stopAuto();
      },
      onRequestAmbientPause:function () {
        window.dispatchEvent(new CustomEvent('afflatus-media-play', { detail:{ source:'narration' } }));
      }
    });
    window.addEventListener('afflatus-media-play', function (event) {
      if (event.detail && event.detail.source === 'ambient') narrationPlayer.pause();
    });
  }

  function ensurePagedBook() {
    if (pagedBook) return pagedBook;
    pagedBook = serialApi.createPagedBook({
      stage:document.getElementById('bookStage'),
      content:document.getElementById('chapterBody'),
      measure:document.getElementById('bookMeasure'),
      turnLayer:document.getElementById('bookTurn'),
      turnFront:document.getElementById('bookTurnFront'),
      turnBack:document.getElementById('bookTurnBack'),
      pageIndicator:document.getElementById('pageIndicator'),
      previousHotspot:document.getElementById('pagePreviousHotspot'),
      nextHotspot:document.getElementById('pageNextHotspot'),
      isActive:function () { return !state.waterfall && document.body.dataset.readerView === 'reading'; },
      onBoundary:function (direction) {
        var target = state.idx + direction;
        if (target < 0) {
          toast('已经是第一章的第一页');
          return false;
        }
        if (target >= state.chapters.length) {
          stopAuto();
          toast('已经是最新一章啦，明天再来吧～');
          return false;
        }
        loadChapter(target, false, null, 'push', {
          direction:direction,
          pageIndex:direction > 0 ? 0 : 'last'
        });
        return true;
      },
      onPageChange:function () {
        if (readerNotes) readerNotes.decorate();
        saveProgress();
        if (experience) experience.sync();
        updateProgressBar();
      }
    });
    return pagedBook;
  }

  function loadChapter(i, scrollToTop, after, historyMode, pageSettings) {
    if (i < 0 || i >= state.chapters.length) return;
    withChapter(i, function () {
      state.idx = i;
      var c = state.chapters[i];
      document.getElementById('chapterTitle').textContent = c.title;
      document.getElementById('chapterMeta').textContent =
        '第 ' + (i + 1) + ' / ' + state.chapters.length + ' 章 · 约 ' + (c.wordCount || 0) + ' 字';
      document.getElementById('chapterIndicator').textContent =
        '第 ' + (i + 1) + ' / ' + state.chapters.length + ' 章';
      [['prevChapter', i - 1], ['nextChapter', i + 1]].forEach(function (entry) {
        var link = document.getElementById(entry[0]), target = state.chapters[entry[1]];
        link.setAttribute('aria-disabled', String(!target));
        if (target) {
          link.href = serialApi.readerPath({ locale:serialApi.readerLocale(location.pathname, document.documentElement.dataset.afflatusLocale), bookId:state.novelId, chapterId:target.id });
        } else link.removeAttribute('href');
      });
      syncReaderUrl(c.id, historyMode || 'replace');
      var book = ensurePagedBook();
      book.setChapterContext({
        hasPreviousChapter:i > 0,
        hasNextChapter:i < state.chapters.length - 1
      });
      book.setContent(chapterHtml(c), pageSettings || { pageIndex:0 });
      syncNarrationChapter(c);
      markVisited(c.id);
      renderToc();
      updateProgressBar();
      if (scrollToTop !== false) {
        var targetOffset = Math.max(0, reader.getBoundingClientRect().top + window.scrollY - 12);
        window.scrollTo({ top:0, behavior:'instant' });
        persistProgress(currentPageIndex());
      } else {
        saveProgress();
      }
      // Prefetch the next chapter so turning past this one is instant.
      if (i + 1 < state.chapters.length) ensureChapter(state.novelId, state.chapters[i + 1]).catch(function () {});
      document.body.dataset.readerReady = 'true';
      if (after) setTimeout(after, 260);
    });
  }

  /* ---------- unified chapter navigation entry point ---------- */
  function goToChapter(i, scrollToTop) {
    if (i < 0 || i >= state.chapters.length) return;
    if (state.waterfall) {
      resetWaterfallFrom(i, scrollToTop, 'push');
      return;
    }
    var direction = i > state.idx ? 1 : -1;
    loadChapter(i, scrollToTop, null, 'push', { direction:direction, pageIndex:0 });
  }
  ['prevChapter', 'nextChapter'].forEach(function (id) {
    document.getElementById(id).addEventListener('click', function (event) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      // Before the small TOC has arrived, keep the prerendered href usable.
      if (!state.chapters.length) return;
      event.preventDefault();
      if (this.getAttribute('aria-disabled') === 'true') return;
      goToChapter(state.idx + (id === 'prevChapter' ? -1 : 1), true);
      document.getElementById('bookStage').focus({ preventScroll:true });
    });
  });

  /* ---------- waterfall / infinite-scroll reading ---------- */
  var wfList = document.getElementById('waterfallList');
  var wfSentinel = document.getElementById('wfSentinel');
  var wfSentinelText = document.getElementById('wfSentinelText');
  var wfChip = document.getElementById('wfChip');
  var wfHeaderObserver = null, wfSentinelObserver = null;
  var wfDone = false;

  function updateLayoutToggle() {
    var btn = document.getElementById('layoutToggle');
    btn.classList.toggle('active', state.waterfall);
    btn.textContent = state.waterfall ? '切回分页阅读' : '切换连续阅读';
    btn.setAttribute('aria-pressed', String(state.waterfall));
    btn.setAttribute(
      'aria-label',
      state.waterfall
        ? T('Close continuous reading and return to page view', '关闭连续阅读，切回分页阅读')
        : T('Switch to continuous reading', '切换为瀑布流连续阅读')
    );
    btn.title = state.waterfall ? '切回分页阅读' : '瀑布流连续阅读';
  }

  function updateWaterfallChip(i) {
    wfChip.textContent = '第 ' + (i + 1) + ' / ' + state.chapters.length + ' 章 · ' +
      state.chapters[i].title.replace(/^第\d+章\s*·\s*/, '');
  }

  function wfAppendChapter(i) {
    var c = state.chapters[i];
    var sec = document.createElement('section');
    sec.className = 'wf-chapter';
    sec.dataset.idx = String(i);
    sec.dataset.chapterId = String(c.id);
    sec.innerHTML = '<h2>' + escapeHtml(c.title) + '</h2>' +
      '<p class="meta">第 ' + (i + 1) + ' / ' + state.chapters.length +
      ' 章 · 约 ' + (c.wordCount || 0) + ' 字</p>' +
      '<div class="body">' + chapterHtml(c) + '</div>';
    wfList.appendChild(sec);
    if (i < state.chapters.length - 1) {
      var divider = document.createElement('div');
      divider.className = 'wf-divider';
      divider.textContent = '继续下滑 · 下一章';
      wfList.appendChild(divider);
    }
    markVisited(c.id);
    if (wfHeaderObserver) wfHeaderObserver.observe(sec);
    return sec;
  }

  function finishWaterfall() {
    wfDone = true;
    wfSentinel.classList.add('done');
    wfSentinelText.textContent = '已经是最新一章啦，明天再来吧～';
    if (wfSentinelObserver) wfSentinelObserver.disconnect();
  }

  var wfLoadSeq = 0, wfLoading = false;
  function wfLoadNext() {
    if (wfDone || wfLoading) return;
    var next = state.wfIndex + 1;
    if (next >= state.chapters.length) {
      finishWaterfall();
      return;
    }
    var seq = wfLoadSeq;
    wfLoading = true;
    ensureChapter(state.novelId, state.chapters[next]).then(function () {
      if (seq !== wfLoadSeq) return;
      wfLoading = false;
      state.wfIndex = next;
      wfAppendChapter(next);
      renderToc();
      if (next === state.chapters.length - 1) finishWaterfall();
      else wfKeepLoading();
    }, function () {
      if (seq !== wfLoadSeq) return;
      wfLoading = false;
      wfSentinelText.textContent = '下一章暂时没加载出来，稍后自动重试…';
      setTimeout(function () {
        if (seq !== wfLoadSeq) return;
        wfSentinelText.textContent = '继续下滑，自动加载下一章…';
        wfKeepLoading();
      }, 5000);
    });
  }
  // The sentinel observer only reports changes, so re-arm it after an async
  // append in case it is still in range; without IntersectionObserver keep
  // appending chapters in order.
  function wfKeepLoading() {
    if (!wfSentinelObserver) { wfLoadNext(); return; }
    wfSentinelObserver.unobserve(wfSentinel);
    wfSentinelObserver.observe(wfSentinel);
  }

  function setupWfObservers() {
    if (!('IntersectionObserver' in window)) return false;
    wfHeaderObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!state.waterfall || !entry.isIntersecting) return;
        var i = Number(entry.target.dataset.idx);
        state.idx = i;
        syncNarrationChapter(state.chapters[i]);
        updateWaterfallChip(i);
        renderToc();
        updateProgressBar();
        saveProgress();
        syncReaderUrl(state.chapters[i].id, 'replace');
      });
    }, { rootMargin:'-45% 0px -50% 0px', threshold:0 });
    wfSentinelObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (state.waterfall && entry.isIntersecting) wfLoadNext();
      });
    }, { rootMargin:'800px 0px' });
    return true;
  }

  function resetWaterfallFrom(i, scrollToTop, historyMode, restoreOffset, restoreAnchor) {
    if (i < 0 || i >= state.chapters.length) return;
    withChapter(i, function () {
      state.idx = i;
      if (wfHeaderObserver) wfHeaderObserver.disconnect();
      if (wfSentinelObserver) wfSentinelObserver.disconnect();
      wfList.innerHTML = '';
      wfDone = false;
      wfSentinel.classList.remove('done');
      wfSentinelText.textContent = '继续下滑，自动加载下一章…';
      wfLoadSeq += 1;
      wfLoading = false;
      state.wfIndex = i;
      var firstSection = wfAppendChapter(i);
      if (firstSection) document.body.dataset.readerReady = 'true';
      if (i + 1 >= state.chapters.length) {
        finishWaterfall();
      } else if (chapterReady(state.novelId, state.chapters[i + 1])) {
        state.wfIndex = i + 1;
        wfAppendChapter(i + 1);
        if (state.wfIndex === state.chapters.length - 1) finishWaterfall();
      }
      if (!wfDone && wfSentinelObserver) wfSentinelObserver.observe(wfSentinel);
      if (!wfHeaderObserver) wfLoadNext();
      updateWaterfallChip(i);
      syncNarrationChapter(state.chapters[i]);
      renderToc();
      syncReaderUrl(state.chapters[i].id, historyMode || 'replace');
      requestAnimationFrame(function () {
        var targetOffset;
        if (restoreOffset != null && restoreOffset > 0) {
          targetOffset = firstSection.getBoundingClientRect().top + window.scrollY + restoreOffset;
        } else if (scrollToTop !== false) {
          targetOffset = Math.max(0, reader.getBoundingClientRect().top + window.scrollY - 12);
        }
        if (targetOffset != null) {
          window.scrollTo({
            top:targetOffset,
            behavior:restoreOffset != null ? 'auto' : 'smooth'
          });
        }
        if (restoreAnchor) serialApi.scrollToTextAnchor(firstSection.querySelector('.body'), restoreAnchor);
        persistProgress(currentReadingOffset());
        updateProgressBar();
      });
    });
  }

  function initWaterfall(fromIdx, scrollToTop, historyMode, restoreOffset, restoreAnchor) {
    state.waterfall = true;
    stopAuto();
    document.getElementById('readerNormal').hidden = true;
    document.getElementById('readerWaterfall').hidden = false;
    wfChip.classList.add('show');
    if (!wfHeaderObserver) setupWfObservers();
    if (readerStore) readerStore.update({ layout:'waterfall' });
    updateLayoutToggle();
    resetWaterfallFrom(fromIdx, scrollToTop, historyMode, restoreOffset, restoreAnchor);
  }

  function initBook(fromIdx, scrollToTop, historyMode, pageIndex, openCover, anchor) {
    if (wfHeaderObserver) wfHeaderObserver.disconnect();
    if (wfSentinelObserver) wfSentinelObserver.disconnect();
    wfLoadSeq += 1;
    wfLoading = false;
    state.waterfall = false;
    stopAuto();
    document.getElementById('readerWaterfall').hidden = true;
    document.getElementById('readerNormal').hidden = false;
    wfChip.classList.remove('show');
    if (readerStore) readerStore.update({ layout:'book' });
    updateLayoutToggle();
    loadChapter(fromIdx, scrollToTop, null, historyMode, {
      pageIndex:restoredPage(pageIndex), anchor:anchor
    });
    if (openCover) ensurePagedBook().open(state.novels[state.novelIdx].novel.title);
  }

  document.getElementById('layoutToggle').addEventListener('click', function () {
    var anchor = currentReadingAnchor();
    document.getElementById('settingsDialog').close();
    if (state.waterfall) {
      initBook(state.idx, true, 'replace', 0, false, anchor);
      toast('已切回分页阅读');
    } else {
      initWaterfall(state.idx, true, 'replace', null, anchor);
      toast('已切换到瀑布流，继续下滑即可连续阅读');
    }
  });

  /* ---------- timed page turning / waterfall auto-scroll ---------- */
  var AUTO_PAGE_INTERVAL = 30000;
  var AUTO_SCROLL_PX_PER_MS = 0.65 / 16;
  var autoTimerKind = '';
  var autoScrollLastFrame = 0;
  function stepAutoScroll(timestamp) {
    if (!state.autoTimer || autoTimerKind !== 'frame' || !state.waterfall) return;
    var elapsed = autoScrollLastFrame ? Math.min(64, timestamp - autoScrollLastFrame) : 0;
    autoScrollLastFrame = timestamp;
    if (elapsed > 0) window.scrollBy(0, AUTO_SCROLL_PX_PER_MS * elapsed);
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
      if (!wfDone) {
        wfLoadNext();
      } else {
        stopAuto();
        toast('已经是最新一章啦，明天再来吧～');
        return;
      }
    }
    if (state.autoTimer && autoTimerKind === 'frame') {
      state.autoTimer = requestAnimationFrame(stepAutoScroll);
    }
  }
  function startAuto() {
    if (narrationPlayer) narrationPlayer.pause();
    stopAuto();
    var btn = document.getElementById('autoToggle');
    btn.textContent = state.waterfall ? '停止滚动' : '停止翻页';
    btn.setAttribute('aria-pressed', 'true');
    document.getElementById('readerAutoStatus').hidden = false;
    document.getElementById('readerSaveStatus').hidden = true;
    btn.classList.add('active');
    btn.setAttribute('aria-label', state.waterfall ? T('Stop automatic scrolling', '停止自动滚动') : T('Stop automatic page turning', '停止自动翻页'));
    if (state.waterfall) {
      autoTimerKind = 'frame';
      autoScrollLastFrame = 0;
      state.autoTimer = requestAnimationFrame(stepAutoScroll);
    } else {
      autoTimerKind = 'interval';
      state.autoTimer = setInterval(function () {
        if (document.hidden || window.getSelection().toString()) { stopAuto(); return; }
        if (!pagedBook || !pagedBook.turn(1)) stopAuto();
      }, Number(document.getElementById('autoSpeed').value) || AUTO_PAGE_INTERVAL);
    }
  }
  function stopAuto() {
    if (autoTimerKind === 'frame') cancelAnimationFrame(state.autoTimer);
    if (autoTimerKind === 'interval') clearInterval(state.autoTimer);
    state.autoTimer = 0;
    autoTimerKind = '';
    autoScrollLastFrame = 0;
    var btn = document.getElementById('autoToggle');
    btn.textContent = state.waterfall ? '开始自动滚动' : '开始自动翻页';
    btn.setAttribute('aria-pressed', 'false');
    document.getElementById('readerAutoStatus').hidden = true;
    document.getElementById('readerSaveStatus').hidden = false;
    btn.classList.remove('active');
    btn.setAttribute('aria-label', state.waterfall ? T('Start automatic scrolling', '开始自动滚动') : T('Start automatic page turning', '开始自动翻页'));
  }
  document.getElementById('readerAutoStatus').addEventListener('click', stopAuto);
  document.getElementById('autoToggle').addEventListener('click', function () {
    if (state.autoTimer) stopAuto(); else { startAuto(); document.getElementById('settingsDialog').close(); }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopAuto(); });
  window.addEventListener('pagehide', stopAuto);
  ['pointerdown','wheel'].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      if (!state.autoTimer) return;
      var t = e.target;
      if (t && t.closest && t.closest('#autoToggle, #readerAutoStatus')) return;
      stopAuto();
      toast(state.waterfall ? '检测到手动滚动，已暂停自动滚动' : '检测到手动翻页，已暂停自动翻页');
    }, { passive: true });
  });

  /* ---------- FAB ---------- */
  var fabMenu = document.getElementById('fabMenu'), fabToggle = document.getElementById('fabToggle');
  fabToggle.addEventListener('click', function () { fabMenu.classList.toggle('open'); });
  document.getElementById('fabTop').addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); fabMenu.classList.remove('open'); });
  document.getElementById('fabTheme').addEventListener('click', function () {
    var order = ['green','night']; var cur = reader.getAttribute('data-theme'); var next = order[(order.indexOf(cur) + 1) % order.length];
    applyTheme(next);
    fabMenu.classList.remove('open');
    toast('已切换到' + ({green:'日间护眼',night:'夜间琥珀（低蓝光）'})[next]);
  });

  /* ---------- bookshelf ---------- */
  function alignShelfToActive(shelf) {
    var active = shelf.querySelector('.book.active');
    if (!active) return;
    requestAnimationFrame(function () {
      if (!active.isConnected || shelf.scrollWidth <= shelf.clientWidth) return;
      var shelfBox = shelf.getBoundingClientRect();
      var activeBox = active.getBoundingClientRect();
      shelf.scrollLeft += activeBox.left - shelfBox.left;
    });
  }

  function renderShelf() {
    var shelf = document.getElementById('shelf'); shelf.innerHTML = '';
    state.novels.forEach(function (n, i) {
      var b = document.createElement('button');
      b.className = 'book' + (i === state.novelIdx ? ' active' : '');
      b.type = 'button';
      b.innerHTML = '<span class="bk-cover"><span class="bk-title">' + escapeHtml(n.novel.title) + '</span><span class="bk-author">' + escapeHtml(n.novel.author || '') + '</span></span>' +
        '<span class="bk-sub">' + escapeHtml(n.novel.subtitle || '') + '</span>' +
        '<span class="bk-description">' + escapeHtml(n.novel.intro || '') + '</span>' +
        '<span class="bk-meta">已发布 ' + n.chapterCount + ' 章 · ' + escapeHtml(n.novel.updateNote || '') + '</span>' +
        '<span class="bk-read">' + (Object.keys((readerState().visited || {})[n.id] || {}).length ? '继续阅读' : '开始阅读') + ' ↗</span>';
      b.addEventListener('click', function () { selectNovel(i, true, null, 'push'); });
      shelf.appendChild(b);
    });
    shelf.classList.remove('is-loading');
    shelf.removeAttribute('aria-busy');
    alignShelfToActive(shelf);
  }

  function renderHud(hud) {
    var panel = document.getElementById('hudPanel'); panel.innerHTML = '';
    (hud || []).forEach(function (g) {
      var div = document.createElement('div'); div.className = 'gauge';
      div.innerHTML = '<div class="lb"><span>' + escapeHtml(g.label) + '</span><b>' + escapeHtml(g.value) + '</b></div>' +
        '<div class="track"><i style="width:' + (g.pct || 0) + '%"></i></div>';
      panel.appendChild(div);
    });
  }

  /* ---------- select / switch novel ---------- */
  function resumeIndex(n, requestedChapterId) {
    var savedState = readerState();
    var position = savedState.positions[n.id] || (savedState.bookId === n.id ? savedState : null);
    var targetChapterId = requestedChapterId != null
      ? requestedChapterId
      : position ? position.chapterId : null;
    if (targetChapterId == null) return 0;
    var resumeMatch = n.chapters.findIndex(function (c) { return serialApi.chapterIdEquals(c.id, targetChapterId); });
    return resumeMatch >= 0 ? resumeMatch : 0;
  }
  function selectNovel(idx, scrollToShelf, requestedChapterId, historyMode, requestedOffset, requestedAnchor) {
    var n = state.novels[idx]; if (!n) return;
    if ((scrollToShelf || requestedChapterId != null) && !serialApi.createPagedBook) {
      import('../lib/readerRuntime.js').then(function (module) {
        serialApi.createPagedBook = module.createPagedBook;
        renderNovelBlocks = module.renderNovelBlocks;
        serialApi.anchorFromVisibleBlock = module.anchorFromVisibleBlock;
        serialApi.scrollToTextAnchor = module.scrollToTextAnchor;
        readerNotes = module.mountReaderNotes({ getBookId:function () { return state.novelId; }, getChapter:function () { return state.chapters[state.idx]; } });
        selectNovel(idx, scrollToShelf, requestedChapterId, historyMode, requestedOffset, requestedAnchor);
      }).catch(showLoadError);
      return;
    }
    if (!n.chapters) {
      fetchJson('novel-toc:' + n.id, { timeoutMs:NOVEL_TIMEOUT_MS }).then(function (data) {
        n.chapters = data.chapters;
        selectNovel(idx, scrollToShelf, requestedChapterId, historyMode, requestedOffset, requestedAnchor);
      }).catch(showLoadError);
      return;
    }
    // Entering a chapter: fetch its body before touching any reader state, so
    // a slow or failed download leaves the current view (and the progress it
    // saves) exactly as it was.
    if (scrollToShelf || requestedChapterId != null) {
      var target = n.chapters[resumeIndex(n, requestedChapterId)];
      if (!chapterReady(n.id, target)) {
        var seq = ++chapterLoadSeq;
        ensureChapter(n.id, target).then(function () {
          if (seq === chapterLoadSeq) selectNovel(idx, scrollToShelf, requestedChapterId, historyMode, requestedOffset, requestedAnchor);
        }, function () {
          if (seq === chapterLoadSeq) toast('网络不太稳定，这一章暂时没加载出来，请稍后再试', 4000);
        });
        return;
      }
    }
    state.novelIdx = idx;
    state.novelId = n.id;
    state.chapters = n.chapters;

    function paintHero() {
      document.getElementById('novelKicker').textContent = (n.novel.tags || []).slice(0, 4).join(' · ') || '无限流 · 连载中';
      document.getElementById('novelTitle').textContent = n.novel.title;
      document.getElementById('novelSub').textContent = n.novel.subtitle || '';
      document.getElementById('novelIntro').textContent = n.novel.intro;
      document.getElementById('novelAuthor').textContent = n.novel.author;
      document.getElementById('bookAuthor').textContent = n.novel.author + ' · 连载手稿';
      document.getElementById('novelUpdateNote').textContent = n.novel.updateNote;
      document.getElementById('novelStart').textContent = n.novel.startDate;
      var tagsEl = document.getElementById('novelTags'); tagsEl.innerHTML = '';
      (n.novel.tags || []).forEach(function (tg) { var s = document.createElement('span'); s.className = 'tag'; s.textContent = tg; tagsEl.appendChild(s); });
      renderHud(n.novel.hud);
      renderShelf();
    }

    /* U30 R1: clicked book cover morphs into the hero pad via a native
       same-document View Transition instead of the content just snapping —
       no library. Skipped on initial boot paint (scrollToShelf is false
       there) since there's no prior visual to morph from. */
    if (scrollToShelf && document.startViewTransition) {
      try {
        var shelfEl = document.getElementById('shelf');
        var clickedBtn = shelfEl && shelfEl.children[idx];
        if (clickedBtn) clickedBtn.style.viewTransitionName = 'novelMorph';
        var vt = document.startViewTransition(function () {
          paintHero();
          var heroPad = document.querySelector('.hero .pad');
          if (heroPad) heroPad.style.viewTransitionName = 'novelMorph';
        });
        vt.finished.catch(function () {}).then(function () {
          var heroPad = document.querySelector('.hero .pad');
          if (heroPad) heroPad.style.viewTransitionName = '';
        });
      } catch (e) { paintHero(); }
    } else {
      paintHero();
    }

    var resumeIdx = resumeIndex(n, requestedChapterId);
    var savedState = readerState();
    var position = savedState.positions[n.id] || (savedState.bookId === n.id ? savedState : null);
    var resumeAnchor = requestedAnchor || (position && (requestedChapterId == null || serialApi.chapterIdEquals(position.chapterId, requestedChapterId)) ? position.anchor : null);
    var resumeOffset = requestedOffset;
    if (resumeOffset == null && position &&
        serialApi.chapterIdEquals(position.chapterId, state.chapters[resumeIdx].id)) {
      resumeOffset = position.offset;
    }
    resumeOffset = Number.isFinite(Number(resumeOffset)) && Number(resumeOffset) > 0
      ? Math.round(Number(resumeOffset))
      : null;
    if (readerStore) readerStore.update({ bookId:n.id });

    document.body.classList.add('reader-enhanced');
    state.idx = resumeIdx;
    if (!scrollToShelf && requestedChapterId == null) {
      experience.setView('library');
      document.body.dataset.readerReady = 'true';
      // A book landing keeps its own work-level metadata; only the shelf
      // itself takes the library's.
      var landingRoute = serialApi.parseReaderPath(location.pathname);
      if (landingRoute && landingRoute.bookId === n.id) syncReaderUrl(state.chapters[resumeIdx].id, 'none');
      else syncLibraryMetadata();
      return;
    }
    experience.setView('reading');
    if (state.waterfall) {
      initWaterfall(
        resumeIdx,
        resumeOffset == null,
        historyMode || (requestedChapterId != null ? 'replace' : 'none'),
        resumeOffset,
        resumeAnchor
      );
    } else {
      initBook(
        resumeIdx,
        resumeOffset == null,
        historyMode || (requestedChapterId != null ? 'replace' : 'none'),
        resumeOffset,
        false,
        resumeAnchor
      );
    }
    if (!state.waterfall && (scrollToShelf || requestedChapterId != null || resumeOffset != null)) {
      requestAnimationFrame(function () { window.scrollTo({ top:0, behavior:'instant' }); });
    }
    if (scrollToShelf && pagedBook && !state.waterfall) pagedBook.open(n.novel.title);
    if (resumeIdx > 0 && requestedChapterId != null) toast('已为你恢复到上次的阅读位置');
    experience.sync();
    if (scrollToShelf) document.getElementById('bookStage').focus({preventScroll:true});
  }

  /* ---------- boot ---------- */
  function boot() {
    if (bootStarted) return;
    bootStarted = true;
    // Readers now fetch per-chapter files; drop whole-book payloads (up to
    // 7.5 MB each) cached by earlier versions of this page.
    purgeCachedJson(/^\/novels\/[a-z0-9-]+\.json$/);
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    try {
      readerStore = serialApi.createReaderStore(serialApi.createStorageAdapter(localStorage), { migrate:false });
    } catch (e) {
      readerStore = serialApi.createReaderStore({
        getItem:function () { return null; },
        setItem:function () {},
        removeItem:function () {}
      }, { migrate:false });
    }
    experience = serialApi.mountReaderExperience({
      store:readerStore,
      getNovel:function () { return state.novels[state.novelIdx]; },
      getChapter:function () { return state.chapters[state.idx]; },
      getPage:function () { return document.body.dataset.readerView === 'reading' && pagedBook ? pagedBook.getState() : null; },
      onContinue:function () { selectNovel(state.novelIdx, true, null, 'push'); },
      onLibrary:function () {
        saveProgress(); stopAuto(); experience.setView('library'); syncLibraryMetadata();
        var locale = serialApi.readerLocale(location.pathname, document.documentElement.dataset.afflatusLocale);
        history.pushState({view:'library', bookId:state.novelId}, '', (locale === 'adaptive' ? '' : '/' + locale) + '/serial.html');
        window.scrollTo({top:0, behavior:'instant'});
        document.getElementById('continueReading').focus({preventScroll:true});
      },
      onBookmark:function (entry) {
        var idx = state.novels.findIndex(function (novel) { return novel.id === entry.bookId; });
        if (idx >= 0) selectNovel(idx, true, entry.chapterId, 'push', entry.offset, entry.anchor);
      },
      onTypography:function () { if (pagedBook) pagedBook.repaginate(); }
    });
    var companionAudio;
    document.querySelectorAll('[data-reader-dialog="audioDialog"]').forEach(function (button) {
      button.addEventListener('click', function () {
        companionAudio ||= import('../lib/companionAudio.js').then(function (module) {
          return module.mountCompanionAudio({ store:readerStore });
        });
        companionAudio.catch(function () { document.getElementById('audioEmpty').textContent = '伴读音乐暂不可用，请刷新页面重试。'; });
      });
    });
    initNarrationPlayer();

    fetchJson('novels-index', { timeoutMs:NOVEL_TIMEOUT_MS }).then(function (data) {
      state.novels = data.novels || [];
      if (!state.novels.length) throw new Error('no novels');
      readerStore.migrate(state.novels.map(function (n) { return n.id; }));
      var savedState = readerState();
      state.waterfall = savedState.layout === 'waterfall';
      updateLayoutToggle();
      applyTheme(savedState.theme);
      curFs = applyFs(savedState.fontSize);
      var route = serialApi.parseReaderPath(location.pathname);

      var startIdx = 0;
      var startBookId = route ? route.bookId : savedState.bookId;
      if (startBookId) {
        var i = state.novels.findIndex(function (n) { return n.id === startBookId; });
        if (i >= 0) startIdx = i;
      }
      var initialOffset = null;
      if (route && history.state &&
          history.state.bookId === route.bookId &&
          serialApi.chapterIdEquals(history.state.chapterId, route.chapterId)) {
        initialOffset = history.state.offset;
        if (history.state.layout) state.waterfall = history.state.layout === 'waterfall';
      }
      selectNovel(
        startIdx,
        false,
        route && route.chapterId,
        route && route.chapterId != null ? 'replace' : 'none',
        initialOffset
      );
    }).catch(showLoadError);
  }
  window.addEventListener('popstate', function (event) {
    if (!serialApi || !state.novels.length) return;
    var route = serialApi.parseReaderPath(location.pathname);
    var saved = event.state || readerState();
    if (saved.layout) state.waterfall = saved.layout === 'waterfall';
    var bookId = route ? route.bookId : saved.bookId;
    var chapterId = route && route.chapterId != null ? route.chapterId : null;
    var idx = state.novels.findIndex(function (n) { return n.id === bookId; });
    if (idx >= 0) selectNovel(idx, false, chapterId, 'none', saved.offset, saved.anchor);
  });
  if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot, { once:true });
}
