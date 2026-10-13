import { describe, expect, it } from 'vitest';
import {
  chapterIdEquals,
  parseReaderPath,
  readerLocale,
  readerPath,
  readerUrl,
} from '../src/lib/serialRoutes.js';

describe('serial reader routes', () => {
  it('builds /zh/ book/chapter paths and still parses legacy ones', () => {
    expect(readerPath({
      locale: 'zh', bookId: 'wanjie-zhongchun', chapterId: 12,
    })).toBe('/zh/novels/wanjie-zhongchun/12/');
    expect(parseReaderPath('/zh/novels/wanjie-zhongchun/12/')).toEqual({
      locale: 'zh',
      bookId: 'wanjie-zhongchun',
      chapterId: '12',
    });
    // Chinese-only: every locale links the /zh/ document (root and /en/ redirect).
    expect(readerPath({
      locale: 'adaptive', bookId: 'changye-qingjian',
    })).toBe('/zh/novels/changye-qingjian/');
    expect(readerUrl({
      locale: 'en', bookId: 'changye-qingjian', chapterId: '7',
    })).toBe('https://feida.au/zh/novels/changye-qingjian/7/');
    expect(parseReaderPath('/novels/changye-qingjian/7/')).toEqual({
      locale: 'adaptive',
      bookId: 'changye-qingjian',
      chapterId: '7',
    });
  });

  it('rejects malformed route segments and unrelated paths', () => {
    expect(parseReaderPath('/serial.html')).toBeNull();
    expect(parseReaderPath('/zh/novels/../1/')).toBeNull();
    expect(() => readerPath({ bookId: '../escape', chapterId: 1 })).toThrow(TypeError);
  });

  it('derives the reader locale and compares numeric/string chapter identities', () => {
    expect(readerLocale('/en/novels/yuxi-gongci/2/', 'zh')).toBe('en');
    expect(readerLocale('/serial.html', 'zh')).toBe('zh');
    expect(chapterIdEquals(2, '2')).toBe(true);
  });
});
