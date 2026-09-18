/**
 * Second line of defence for dictionary HTML: the data build already sanitizes every entry
 * (scripts/sanitize-html.mjs); before injecting, the app checks the same allowlist again and
 * falls back to plain text if anything unexpected is present.
 */
const ALLOWED: Record<string, string[]> = { b: [], i: [], em: [], span: ['class'], div: ['class'], p: [], a: ['class', 'data-ref', 'data-he', 'data-bdb'], br: [], table: [], tr: [], td: [], sup: [], sub: [] };
const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
const ATTR = /([^\s"'<>=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?/g;

export function isSafeDictHtml(html: string): boolean {
  for (const m of html.matchAll(TAG)) {
    const name = m[1].toLowerCase();
    const allowed = ALLOWED[name];
    if (!allowed) return false;
    // prose may legitimately contain "on =" or "javascript:"; only markup is inspected
    if (/on[a-z]+\s*=|javascript:|style\s*=/i.test(m[2])) return false;
    for (const a of m[2].matchAll(ATTR)) {
      const key = a[1].toLowerCase();
      if (key === '/') continue;
      if (!allowed.includes(key)) return false;
    }
  }
  return true;
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}
