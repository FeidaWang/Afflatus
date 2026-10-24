// RFC 5545 §3.3.11 TEXT escaping for .ics values: backslash first, then
// comma and semicolon, and line breaks as a literal "\n" (G5).
export const escapeIcsText = (s) => String(s)
  .replace(/\\/g, '\\\\')
  .replace(/([,;])/g, '\\$1')
  .replace(/\r\n|\r|\n/g, '\\n');
