import { describe, expect, it } from 'vitest';
import { escapeHtml, isSafePlainText, safeExternalUrl } from '../src/lib/contentSafety.js';

describe('contentSafety', () => {
  it('escapes text for element and attribute contexts', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')"> &`))
      .toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp;');
  });

  it('accepts HTTPS research links and rejects executable or insecure protocols', () => {
    expect(safeExternalUrl('https://example.com/research?q=ai')).toBe('https://example.com/research?q=ai');
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('http://example.com')).toBeNull();
    expect(safeExternalUrl('/relative')).toBeNull();
  });

  it('treats scheduled copy as plain text', () => {
    expect(isSafePlainText('Evidence first.')).toBe(true);
    expect(isSafePlainText('<b>trusted?</b>')).toBe(false);
    expect(isSafePlainText('', { allowEmpty: true })).toBe(true);
  });
});
