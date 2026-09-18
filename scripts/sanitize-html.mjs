// Build-time HTML sanitizer for dictionary entries (BDB, Abbott-Smith). The upstream XML/HTML is
// rewritten by the renderers with regular expressions; this is the trust boundary that makes the
// result safe to inject: an explicit element allowlist, an explicit attribute allowlist with
// value validation, dangerous elements removed with their content, and nesting rebalanced.
// `assertSafe` re-validates the output and throws, so a build can never ship unapproved markup.

export const ALLOWED_TAGS = { b: [], i: [], em: [], span: ['class'], div: ['class'], p: [], a: ['class', 'data-ref', 'data-he', 'data-bdb'], br: [], table: [], tr: [], td: [], sup: [], sub: [] };
export const ALLOWED_CLASSES = new Set(['he-inline', 'gr', 'sense', 'n', 'lxx', 'form', 'etym', 'note', 'pos', 'stem']);
const VOID = new Set(['br']);
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'svg', 'object', 'embed', 'noscript', 'template', 'math', 'textarea', 'select', 'option']);
const ATTR_VALUE = {
  class: (v) => v.split(/\s+/).filter((c) => ALLOWED_CLASSES.has(c)).join(' ') || null,
  'data-ref': (v) => (/^[1-3]?[A-Za-z]+\.\d{1,3}(\.\d{1,3})?$/.test(v) ? v : null),
  'data-he': (v) => (/^\d{1,5}$/.test(v) ? v : null),
  'data-bdb': (v) => (/^[a-z]+(\.[a-z]+){1,3}$/.test(v) ? v : null),
};

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', thinsp: ' ' };
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITY[e.toLowerCase()] ?? m;
  });
}
export function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const escapeAttr = (s) => escapeText(s).replace(/"/g, '&quot;');

const TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s"'<>=\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>`]+))?)*)\s*(\/?)\s*>|([^<]+)|(<)/g;
const ATTR = /([^\s"'<>=\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?/g;

export function sanitizeHtml(input) {
  let out = '';
  const stack = [];
  let dropping = null; // { name, depth }
  for (const m of input.matchAll(TOKEN)) {
    const [, closeName, openName, attrText, selfClose, text, lone] = m;
    if (dropping) {
      if (openName && openName.toLowerCase() === dropping.name && !selfClose) dropping.depth++;
      else if (closeName && closeName.toLowerCase() === dropping.name && --dropping.depth === 0) dropping = null;
      continue;
    }
    if (text !== undefined) {
      out += escapeText(decodeEntities(text));
      continue;
    }
    if (lone !== undefined) {
      out += '&lt;';
      continue;
    }
    if (closeName) {
      const name = closeName.toLowerCase();
      const at = stack.lastIndexOf(name);
      if (at < 0) continue; // stray closing tag
      while (stack.length > at) out += `</${stack.pop()}>`;
      continue;
    }
    if (openName) {
      const name = openName.toLowerCase();
      if (DROP_WITH_CONTENT.has(name)) {
        if (!selfClose) dropping = { name, depth: 1 };
        continue;
      }
      const allowed = ALLOWED_TAGS[name];
      if (!allowed) continue; // unknown element: tag dropped, content kept
      let attrs = '';
      for (const a of (attrText || '').matchAll(ATTR)) {
        const key = a[1].toLowerCase();
        if (!allowed.includes(key)) continue;
        const raw = decodeEntities(a[2] ?? a[3] ?? a[4] ?? '');
        const v = ATTR_VALUE[key](raw);
        if (v !== null) attrs += ` ${key}="${escapeAttr(v)}"`;
      }
      if (VOID.has(name)) out += `<${name}>`;
      else {
        out += `<${name}${attrs}>`;
        if (!selfClose) stack.push(name);
        else out += `</${name}>`;
      }
    }
  }
  while (stack.length) out += `</${stack.pop()}>`;
  return out;
}

const TAG_CHECK = /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
/** Throws when anything outside the allowlist survives (a guard for the build). */
export function assertSafe(html, where = '') {
  for (const m of html.matchAll(TAG_CHECK)) {
    const name = m[1].toLowerCase();
    if (!ALLOWED_TAGS[name]) throw new Error(`unsafe element <${name}> in ${where}`);
    for (const a of m[2].matchAll(ATTR)) {
      const key = a[1].toLowerCase();
      if (key === '/') continue;
      if (!ALLOWED_TAGS[name].includes(key)) throw new Error(`unsafe attribute ${key} on <${name}> in ${where}`);
      if (/javascript:|^\s*on/i.test(a[2] ?? a[3] ?? a[4] ?? '')) throw new Error(`unsafe attribute value on <${name}> in ${where}`);
    }
    // prose may legitimately contain "on =" or "javascript:"; only markup is inspected
    if (/on[a-z]+\s*=|javascript:/i.test(m[2])) throw new Error(`unsafe attribute text on <${name}> in ${where}`);
  }
  return html;
}
