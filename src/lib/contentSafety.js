const HTML_ENTITIES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

/** Escape untrusted text before inserting it into an HTML template. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}

/**
 * External research links are data, not markup. Only HTTPS links may leave
 * the page; malformed values and executable protocols are rejected.
 */
export function safeExternalUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Publish-time guard for fields that are contractually plain text. */
export function isSafePlainText(value, { maxLength = 4_000, allowEmpty = false } = {}) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!allowEmpty && !text) return false;
  return text.length <= maxLength && !/[<>]/.test(text);
}
