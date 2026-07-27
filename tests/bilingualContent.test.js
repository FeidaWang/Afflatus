import { describe, expect, it } from 'vitest';
import {
  defineBilingualContent,
  extractPlaceholderTokens,
  validateBilingualPair,
  validateBilingualTree,
} from '../src/lib/bilingualContent.js';
import {
  lintHtmlSource,
  lintJsonSource,
  lintScriptSource,
} from '../scripts/lint-bilingual.mjs';
import {
  formatJsonSource,
  normalizeChinesePunctuation,
} from '../scripts/format-bilingual-content.mjs';

function codes(issues) {
  return issues.map((item) => item.code);
}

describe('bilingual content schema', () => {
  it('defines a valid immutable entry with declared tokens and limits', () => {
    const entry = defineBilingualContent({
      key: 'countdown',
      en: 'Next update: {time}',
      zh: '下次更新：{time}',
      tone: 'functional',
      maxChars: { en: 40, zh: 20 },
      tokens: ['time'],
    });
    expect(entry.schemaVersion).toBe(1);
    expect(entry.tokens).toEqual(['time']);
    expect(Object.isFrozen(entry)).toBe(true);
  });

  it('canonicalizes locale-specific placeholder field names', () => {
    expect(extractPlaceholderTokens('{market_en} %s {clock.zh}')).toEqual([
      '%s',
      'clock',
      'market',
    ]);
  });

  it('reports token, markup, link, glossary, punctuation and length drift', () => {
    const issues = validateBilingualPair({
      en: '<a href="https://example.com">Low confidence {time}</a>',
      zh: '<strong>低确定度,中文 {date}</strong>',
    }, {
      path: 'fixture',
      maxChars: { en: 12, zh: 8 },
    });
    expect(codes(issues)).toEqual(expect.arrayContaining([
      'TOKEN_MISMATCH',
      'MARKUP_MISMATCH',
      'LINK_MISMATCH',
      'GLOSSARY_MISMATCH',
      'ZH_ASCII_PUNCTUATION',
      'EN_LABEL_TOO_LONG',
      'ZH_LABEL_TOO_LONG',
    ]));
  });

  it('checks nested locale maps and explicit suffix fields', () => {
    const issues = validateBilingualTree({
      en: { title: 'Title', summary: 'Summary' },
      zh: { title: '标题' },
      note_en: 'English note',
    });
    expect(codes(issues)).toEqual(expect.arrayContaining([
      'ORPHAN_EN_KEY',
    ]));
    expect(validateBilingualTree(
      { editorial_note_en: 'Intentional source-language note' },
      { allowOrphanLocales: true },
    )).toEqual([]);
  });
});

describe('bilingual repository lint adapters', () => {
  it('reads HTML attributes and inline JavaScript objects', () => {
    const issues = lintHtmlSource(`
      <button data-en="Save" data-zh="">Save</button>
      <script>const copy = { en: 'Hello {name}', zh: '你好' };</script>
    `);
    expect(codes(issues)).toEqual(expect.arrayContaining([
      'MISSING_ZH',
      'TOKEN_MISMATCH',
    ]));
  });

  it('reads JavaScript suffix pairs without treating runtime templates as copy tokens', () => {
    const issues = lintScriptSource(`
      const good = { title_en: \`Hello \${nameEn}\`, title_zh: \`你好 \${nameZh}\` };
      const bad = { summary_en: 'Summary' };
    `);
    expect(codes(issues)).not.toContain('TOKEN_MISMATCH');
    expect(codes(issues)).toContain('ORPHAN_EN_KEY');
  });

  it('reads JSON locale branches and reports orphan keys', () => {
    const issues = lintJsonSource(JSON.stringify({
      en: { title: 'Title' },
      zh: { title: '标题', extra: '额外' },
    }));
    expect(codes(issues)).toContain('ORPHAN_ZH_KEY');
  });
});

describe('Chinese punctuation formatter', () => {
  it('normalizes punctuation beside Han text and Chinese straight quotes', () => {
    expect(normalizeChinesePunctuation('中文,test;中文:"引用"')).toBe(
      '中文，test；中文：「引用」',
    );
  });

  it('preserves source formatting when no Chinese change is required', () => {
    const source = '{"en":"Hello", "zh":"你好。"}\n';
    expect(formatJsonSource(source)).toBe(source);
  });
});
