import { describe, expect, it, vi } from 'vitest';
import {
  createReaderStore,
  DEFAULT_READER_STATE,
  READER_STORE_KEY,
} from '../src/lib/readerStore.js';

class MemoryAdapter {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

describe('reader store', () => {
  it('normalizes updates into one versioned schema', () => {
    const adapter = new MemoryAdapter();
    const store = createReaderStore(adapter, { migrate: false });
    store.update({ theme: 'night', fontSize: 99, layout: 'unknown' });
    store.setProgress('wanjie-zhongchun', 3, 412);
    store.setBookmark('wanjie-zhongchun', {
      chapterId: 3,
      chapterTitle: '第三章',
      scrollY: 420,
      ts: 10,
    });
    store.markVisited('wanjie-zhongchun', 3);
    store.setAudioTrack(2);

    expect(store.getState()).toEqual({
      ...DEFAULT_READER_STATE,
      bookId: 'wanjie-zhongchun',
      chapterId: 3,
      offset: 412,
      theme: 'night',
      fontSize: 24,
      bookmarks: {
        'wanjie-zhongchun': {
          chapterId: 3,
          chapterTitle: '第三章',
          offset: 420,
          updatedAt: 10,
        },
      },
      visited: { 'wanjie-zhongchun': [3] },
      audioTrack: 2,
    });
    expect(JSON.parse(adapter.getItem(READER_STORE_KEY)).version).toBe(1);
  });

  it('migrates scattered legacy keys once and removes them after a verified write', () => {
    const adapter = new MemoryAdapter({
      'afflatus:novels:theme': 'night',
      'afflatus:novels:fs': '20',
      'afflatus:novels:lastNovel': 'wanjie-zhongchun',
      'afflatus:novels:player:idx': '4',
      'afflatus:novels:wanjie-zhongchun:progress': JSON.stringify({
        chapterId: 5, scrollY: 900,
      }),
      'afflatus:novels:wanjie-zhongchun:bookmark': JSON.stringify({
        chapterId: 4, chapterTitle: '第四章', scrollY: 700, ts: 12,
      }),
      'afflatus:novels:wanjie-zhongchun:visited': JSON.stringify([1, 2, 2]),
    });
    const store = createReaderStore(adapter, {
      migrate: false,
    });
    store.migrate(['wanjie-zhongchun']);

    expect(store.getState()).toMatchObject({
      theme: 'night',
      fontSize: 20,
      bookId: 'wanjie-zhongchun',
      chapterId: 5,
      offset: 900,
      audioTrack: 4,
      visited: { 'wanjie-zhongchun': [1, 2] },
    });
    expect(adapter.getItem('afflatus:novels:theme')).toBeNull();
    store.migrate(['different-book']);
    expect(store.getState().bookId).toBe('wanjie-zhongchun');
  });

  it('keeps legacy keys when the versioned write cannot be verified byte-for-byte', () => {
    const adapter = new MemoryAdapter({
      [READER_STORE_KEY]: '{broken',
      'afflatus:novels:theme': 'night',
      'afflatus:novels:lastNovel': 'wanjie-zhongchun',
    });
    adapter.setItem = () => {};

    const store = createReaderStore(adapter, { migrate: false });
    store.migrate(['wanjie-zhongchun']);

    expect(store.getState()).toMatchObject({
      theme: 'night',
      bookId: 'wanjie-zhongchun',
    });
    expect(adapter.getItem('afflatus:novels:theme')).toBe('night');
    expect(adapter.getItem('afflatus:novels:lastNovel')).toBe('wanjie-zhongchun');
  });

  it('notifies subscribers without exposing adapter failures', () => {
    const adapter = new MemoryAdapter();
    const store = createReaderStore(adapter, { migrate: false });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.update({ theme: 'night' });
    unsubscribe();
    store.update({ theme: 'green' });
    expect(listener).toHaveBeenCalledOnce();
  });
});
