import { describe, expect, it } from 'vitest';
import { escapeIcsText } from '../src/lib/icsText.js';

describe('escapeIcsText (RFC 5545 TEXT)', () => {
  it('escapes backslash, comma, semicolon and line breaks', () => {
    expect(escapeIcsText('a\\b')).toBe('a\\\\b');
    expect(escapeIcsText('x, y; z')).toBe('x\\, y\\; z');
    expect(escapeIcsText('one\ntwo\r\nthree\rfour')).toBe('one\\ntwo\\nthree\\nfour');
    expect(escapeIcsText('\\,')).toBe('\\\\\\,'); // backslash escaped before the comma's own escape
  });

  it('leaves no raw line break that could start a new property', () => {
    expect(escapeIcsText('x\nDTSTART:19700101')).not.toMatch(/[\r\n]/);
  });
});
