export const BILINGUAL_SCHEMA_VERSION = 1;

export const BILINGUAL_GLOSSARY = Object.freeze([
  { pattern: /\bdrawdown\b/i, acceptedZh: ['回撤'], label: 'drawdown/回撤' },
  {
    pattern: /\bconfidence\b(?!\s+(?:interval|band|field))/i,
    acceptedZh: ['置信度', '信心', '可信度', '士气'],
    label: 'confidence/置信度或信心',
  },
  {
    pattern: /\bstale\b/i,
    acceptedZh: ['数据已过时', '已过时', '陈旧'],
    label: 'stale/数据已过时',
  },
  {
    pattern: /\bdesk view\b/i,
    acceptedZh: ['个人案头观点', '案头观点', '台面观点'],
    label: 'desk view/个人案头观点',
  },
  {
    pattern: /\bentertainment only\b/i,
    acceptedZh: ['仅供娱乐'],
    label: 'entertainment only/仅供娱乐',
  },
]);

export const UI_LABEL_LIMITS = Object.freeze({
  button: Object.freeze({ en: 72, zh: 36 }),
  label: Object.freeze({ en: 72, zh: 36 }),
  option: Object.freeze({ en: 72, zh: 36 }),
  summary: Object.freeze({ en: 90, zh: 45 }),
  placeholder: Object.freeze({ en: 64, zh: 32 }),
  ariaLabel: Object.freeze({ en: 90, zh: 45 }),
});

function issue(code, path, message) {
  return { code, path, message };
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function equalLists(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function extractPlaceholderTokens(value) {
  const tokens = [];
  const source = String(value || '');
  const pattern = /\{([A-Za-z][\w.-]*)\}|(%[sdif])/g;
  for (const match of source.matchAll(pattern)) {
    const token = match[1] || match[2];
    tokens.push(token
      .replace(/(?:_en|_zh|\.en|\.zh)\b/gi, '')
      .replace(/(?:En|Zh)\b/g, ''));
  }
  return sorted(tokens);
}

export function extractMarkupSlots(value) {
  const slots = [];
  for (const match of String(value || '').matchAll(/<(\/?)([A-Za-z][\w-]*)\b[^>]*>/g)) {
    if (match[2].toLowerCase() !== 'br') {
      slots.push(`${match[1] || ''}${match[2].toLowerCase()}`);
    }
  }
  return sorted(slots);
}

export function extractContentLinks(value) {
  const links = [];
  const source = String(value || '');
  for (const match of source.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) links.push(match[1]);
  for (const match of source.matchAll(/\b(?:https?:\/\/|mailto:)[^\s"'<>]+/gi)) links.push(match[0]);
  return sorted(new Set(links));
}

function textLength(value) {
  return [...String(value || '').replace(/<[^>]*>/g, '')].length;
}

function validatePunctuation(en, zh, path) {
  const issues = [];
  if (/(?:[\p{Script=Han}][,;:!?]|[,;:!?][\p{Script=Han}])/u.test(zh)) {
    issues.push(issue(
      'ZH_ASCII_PUNCTUATION',
      path,
      'Chinese prose uses ASCII punctuation beside Chinese text; use full-width punctuation.',
    ));
  }
  if (/"[^"]*\p{Script=Han}[^"]*"/u.test(zh)) {
    issues.push(issue(
      'ZH_STRAIGHT_QUOTES',
      path,
      'Chinese prose uses straight double quotes; use 「」 for quoted Chinese text.',
    ));
  }
  if (/[A-Za-z][，。！？；：]/u.test(en)) {
    issues.push(issue(
      'EN_FULL_WIDTH_PUNCTUATION',
      path,
      'English copy uses Chinese full-width punctuation after Latin text.',
    ));
  }
  return issues;
}

export function validateBilingualPair(pair, options = {}) {
  const path = options.path || 'content';
  const issues = [];
  if (!pair || typeof pair !== 'object') {
    return [issue('INVALID_PAIR', path, 'Bilingual content must be an object with en and zh values.')];
  }
  if (typeof pair.en !== 'string' || !pair.en.trim()) {
    issues.push(issue('MISSING_EN', path, 'English content is missing or empty.'));
  }
  if (typeof pair.zh !== 'string' || !pair.zh.trim()) {
    issues.push(issue('MISSING_ZH', path, 'Chinese content is missing or empty.'));
  }
  if (issues.length) return issues;

  const en = pair.en;
  const zh = pair.zh;
  const enTokens = extractPlaceholderTokens(en);
  const zhTokens = extractPlaceholderTokens(zh);
  if (!equalLists(enTokens, zhTokens)) {
    issues.push(issue(
      'TOKEN_MISMATCH',
      path,
      `Placeholder tokens differ: en=[${enTokens.join(', ')}], zh=[${zhTokens.join(', ')}].`,
    ));
  }

  if (options.markup !== false) {
    const enSlots = extractMarkupSlots(en);
    const zhSlots = extractMarkupSlots(zh);
    if (!equalLists(enSlots, zhSlots)) {
      issues.push(issue(
        'MARKUP_MISMATCH',
        path,
        `Markup slots differ: en=[${enSlots.join(', ')}], zh=[${zhSlots.join(', ')}].`,
      ));
    }
  }

  const enLinks = extractContentLinks(en);
  const zhLinks = extractContentLinks(zh);
  if (!equalLists(enLinks, zhLinks)) {
    issues.push(issue(
      'LINK_MISMATCH',
      path,
      `Embedded links differ: en=[${enLinks.join(', ')}], zh=[${zhLinks.join(', ')}].`,
    ));
  }

  const declaredTokens = Array.isArray(options.tokens) ? sorted(options.tokens) : null;
  if (declaredTokens && !equalLists(declaredTokens, enTokens)) {
    issues.push(issue(
      'DECLARED_TOKEN_MISMATCH',
      path,
      `Declared tokens [${declaredTokens.join(', ')}] do not match content tokens [${enTokens.join(', ')}].`,
    ));
  }

  const maxChars = options.maxChars || null;
  if (maxChars?.en && textLength(en) > maxChars.en) {
    issues.push(issue('EN_LABEL_TOO_LONG', path, `English label exceeds ${maxChars.en} characters.`));
  }
  if (maxChars?.zh && textLength(zh) > maxChars.zh) {
    issues.push(issue('ZH_LABEL_TOO_LONG', path, `Chinese label exceeds ${maxChars.zh} characters.`));
  }

  if (options.punctuation !== false) issues.push(...validatePunctuation(en, zh, path));

  if (options.glossary !== false) {
    for (const term of BILINGUAL_GLOSSARY) {
      if (
        term.pattern.test(en)
        && !term.acceptedZh.some((translation) => zh.includes(translation))
      ) {
        issues.push(issue(
          'GLOSSARY_MISMATCH',
          path,
          `Preferred glossary term is missing: ${term.label}.`,
        ));
      }
    }
  }
  return issues;
}

function compareLocaleValues(en, zh, options, path) {
  if (typeof en === 'string' || typeof zh === 'string') {
    if (options.allowEmptyPair && !String(en || '').trim() && !String(zh || '').trim()) return [];
    return validateBilingualPair({ en, zh }, { ...options, path });
  }
  if (Array.isArray(en) || Array.isArray(zh)) {
    if (!Array.isArray(en) || !Array.isArray(zh)) {
      return [issue('LOCALE_SHAPE_MISMATCH', path, 'EN/ZH values must use the same array shape.')];
    }
    const issues = [];
    if (en.length !== zh.length) {
      issues.push(issue('LOCALE_ARRAY_LENGTH', path, `EN/ZH arrays differ in length (${en.length}/${zh.length}).`));
    }
    const length = Math.min(en.length, zh.length);
    for (let index = 0; index < length; index += 1) {
      issues.push(...compareLocaleValues(en[index], zh[index], options, `${path}[${index}]`));
    }
    return issues;
  }
  if (en && zh && typeof en === 'object' && typeof zh === 'object') {
    const issues = [];
    const enKeys = Object.keys(en);
    const zhKeys = Object.keys(zh);
    for (const key of enKeys.filter((key) => !zhKeys.includes(key))) {
      issues.push(issue('ORPHAN_EN_KEY', `${path}.${key}`, 'English key has no Chinese counterpart.'));
    }
    for (const key of zhKeys.filter((key) => !enKeys.includes(key))) {
      issues.push(issue('ORPHAN_ZH_KEY', `${path}.${key}`, 'Chinese key has no English counterpart.'));
    }
    for (const key of enKeys.filter((key) => zhKeys.includes(key))) {
      issues.push(...compareLocaleValues(en[key], zh[key], options, `${path}.${key}`));
    }
    return issues;
  }
  return [];
}

function suffixGroups(value) {
  const groups = new Map();
  for (const key of Object.keys(value)) {
    const match = key.match(/^(.*?)(?:_(en|zh)|(En|Zh))$/);
    if (!match || !match[1]) continue;
    const locale = (match[2] || match[3]).toLowerCase();
    if (!groups.has(match[1])) groups.set(match[1], {});
    groups.get(match[1])[locale] = key;
  }
  return groups;
}

export function validateBilingualTree(value, options = {}, path = options.path || 'content') {
  if (!value || typeof value !== 'object') return [];
  const issues = [];
  const hasEn = Object.prototype.hasOwnProperty.call(value, 'en');
  const hasZh = Object.prototype.hasOwnProperty.call(value, 'zh');
  if (hasEn || hasZh) {
    if (!hasEn && !options.allowOrphanLocales) issues.push(issue('ORPHAN_ZH_KEY', `${path}.zh`, 'Chinese locale has no English counterpart.'));
    else if (!hasZh && !options.allowOrphanLocales) issues.push(issue('ORPHAN_EN_KEY', `${path}.en`, 'English locale has no Chinese counterpart.'));
    else {
      if (hasEn && hasZh) {
        issues.push(...compareLocaleValues(value.en, value.zh, {
          ...options,
          maxChars: value.maxChars || options.maxChars,
          tokens: value.tokens || options.tokens,
        }, path));
      }
    }
  }

  for (const [base, group] of suffixGroups(value)) {
    const legacyEnglishKey = group.zh?.endsWith('_zh') &&
      Object.prototype.hasOwnProperty.call(value, base)
      ? base
      : null;
    const enKey = group.en || legacyEnglishKey;
    const zhKey = group.zh;
    const usesExplicitSuffix = String(group.en || group.zh || '').includes('_');
    if (!enKey && usesExplicitSuffix && !options.allowOrphanLocales) {
      issues.push(issue('ORPHAN_ZH_KEY', `${path}.${zhKey}`, `Chinese field "${zhKey}" has no English counterpart.`));
    } else if (!zhKey && usesExplicitSuffix && !options.allowOrphanLocales) {
      issues.push(issue('ORPHAN_EN_KEY', `${path}.${enKey}`, `English field "${enKey}" has no Chinese counterpart.`));
    } else if (enKey && zhKey && (
      typeof value[enKey] === 'string' ||
      typeof value[zhKey] === 'string'
    )) {
      issues.push(...validateBilingualPair(
        { en: value[enKey], zh: value[zhKey] },
        { ...options, path: `${path}.${base}` },
      ));
    }
  }

  if (options.recurse !== false) {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'en' || key === 'zh' || key === 'maxChars' || key === 'tokens') continue;
      if (child && typeof child === 'object') {
        issues.push(...validateBilingualTree(child, options, `${path}.${key}`));
      }
    }
  }
  return issues;
}

export function defineBilingualContent(entry) {
  const issues = validateBilingualPair(entry, {
    path: entry?.key || 'content',
    maxChars: entry?.maxChars,
    tokens: entry?.tokens,
  });
  if (issues.length) {
    throw new TypeError(issues.map((item) => `${item.code} ${item.path}: ${item.message}`).join('\n'));
  }
  return Object.freeze({
    schemaVersion: BILINGUAL_SCHEMA_VERSION,
    key: entry.key,
    en: entry.en,
    zh: entry.zh,
    tone: entry.tone || 'neutral',
    maxChars: entry.maxChars || null,
    tokens: Object.freeze([...(entry.tokens || [])]),
  });
}
