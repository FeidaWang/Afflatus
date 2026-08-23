import { describe, expect, it } from 'vitest';
import {
  chapterIdEquals,
  parseReaderPath,
  readerLocale,
  readerPath,
  readerUrl,
} from '../src/lib/serialRoutes.js';

describe('serial reader routes', () => {
  it('round-trips adaptive and Chinese book/chapter paths', () => {
    expect(readerPath({
      locale: 'zh', bookId: 'wanjie-zhongchun', chapterId: 12,
    })).toBe('/zh/novels/wanjie-zhongchun/12/');
    expect(parseReaderPath('/zh/novels/wanjie-zhongchun/12/')).toEqual({
      locale: 'zh',
      bookId: 'wanjie-zhongchun',
      chapterId: '12',
    });
    expect(readerPath({
      locale: 'adaptive', bookId: 'changye-qingjian',
    })).toBe('/novels/changye-qingjian/');
    expect(readerUrl({
      locale: 'zh', bookId: 'changye-qingjian', chapterId: '7',
    })).toBe('https://feida.au/zh/novels/changye-qingjian/7/');
  });

  it('rejects malformed route segments and unrelated paths', () => {
    expect(parseReaderPath('/serial.html')).toBeNull();
    expect(parseReaderPath('/en/novels/yuxi-gongci/2/')).toBeNull();
    expect(parseReaderPath('/zh/novels/../1/')).toBeNull();
    expect(() => readerPath({ locale: 'en', bookId: 'yuxi-gongci', chapterId: 1 })).toThrow(TypeError);
    expect(() => readerPath({ bookId: '../escape', chapterId: 1 })).toThrow(TypeError);
  });

  it('derives the reader locale and compares numeric/string chapter identities', () => {
    expect(readerLocale('/zh/novels/yuxi-gongci/2/', 'zh')).toBe('zh');
    expect(readerLocale('/serial.html', 'zh')).toBe('zh');
    expect(chapterIdEquals(2, '2')).toBe(true);
  });
});
