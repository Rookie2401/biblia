import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM build script
import { assertSafe, sanitizeHtml } from '../scripts/sanitize-html.mjs';
import { isSafeDictHtml, stripTags } from '../src/text/safeHtml.ts';

describe('dictionary HTML sanitizer (build time)', () => {
  it('keeps the approved markup and attributes', () => {
    const html = '<div class="sense"><span class="n">1</span> <b>a word</b>, <a data-ref="Gen.1.1">Gn 1:1</a>; <a class="he-inline" data-he="1697">דָּבָר</a> <a data-bdb="a.ab.ab">x</a><br><table><tr><td>c</td></tr></table></div>';
    expect(sanitizeHtml(html)).toBe(html);
    expect(() => assertSafe(html, 'fixture')).not.toThrow();
  });
  it('removes scripts, styles, iframes and svg with their content', () => {
    const html = '<b>ok</b><script>alert(1)</script><style>b{color:red}</style><iframe src="x"></iframe><svg onload="alert(1)"><circle/></svg><object data="x"></object>after';
    expect(sanitizeHtml(html)).toBe('<b>ok</b>after');
  });
  it('drops event handlers, style, href and unknown attributes and classes', () => {
    const html = '<a href="javascript:alert(1)" onclick="x()" data-ref="Gen.1.1" style="color:red" data-foo="1">Gn 1:1</a><span class="he-inline evil" onmouseover="x()">w</span><img src=x onerror="alert(1)">';
    expect(sanitizeHtml(html)).toBe('<a data-ref="Gen.1.1">Gn 1:1</a><span class="he-inline">w</span>');
  });
  it('validates attribute values', () => {
    expect(sanitizeHtml('<a data-ref="javascript:x">r</a>')).toBe('<a>r</a>');
    expect(sanitizeHtml('<a data-he="12a">r</a>')).toBe('<a>r</a>');
    expect(sanitizeHtml('<a data-bdb="a.ab.ab">r</a>')).toBe('<a data-bdb="a.ab.ab">r</a>');
  });
  it('rebalances malformed nesting and escapes stray characters', () => {
    expect(sanitizeHtml('<b>bold <i>both</b> tail')).toBe('<b>bold <i>both</i></b> tail');
    expect(sanitizeHtml('a < b &amp; c &lt;d&gt; </i>')).toBe('a &lt; b &amp; c &lt;d&gt; ');
    expect(sanitizeHtml('<unknown>kept text</unknown>')).toBe('kept text');
  });
  it('assertSafe rejects unapproved output', () => {
    expect(() => assertSafe('<b onclick="x()">a</b>', 'f')).toThrow(/unsafe/);
    expect(() => assertSafe('<script>1</script>', 'f')).toThrow(/unsafe/);
    expect(() => assertSafe('<span data-ref="x">a</span>', 'f')).toThrow(/unsafe/);
  });
});

describe('dictionary HTML check (render time)', () => {
  it('accepts sanitized entries and refuses anything else', () => {
    expect(isSafeDictHtml('<div class="sense"><a data-ref="Gen.1.1">x</a></div>')).toBe(true);
    expect(isSafeDictHtml('<b onclick="x()">a</b>')).toBe(false);
    expect(isSafeDictHtml('<a href="javascript:1">a</a>')).toBe(false);
    expect(isSafeDictHtml('<svg></svg>')).toBe(false);
    expect(isSafeDictHtml('<span style="color:red">a</span>')).toBe(false);
    expect(stripTags('<b>a</b> &amp; b')).toBe('a & b');
  });
});
