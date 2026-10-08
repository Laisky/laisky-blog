import DOMPurify from 'dompurify';
import { parse, stringify } from 'flatted';
import mermaid from 'mermaid';
import { beforeAll, describe, expect, it } from 'vitest';

/** initializeMermaid selects the existing strict diagram mode for local compatibility checks. */
function initializeMermaid() {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
}

beforeAll(initializeMermaid);

describe('frontend dependency compatibility', () => {
  it('rejects inherited array properties as circular JSON references', () => {
    const parsed = parse('[{"value":"__proto__"}]');
    expect(parsed.value).toBeUndefined();
  });

  it('retains supported circular JSON round trips for dependency tooling', () => {
    const record = { label: 'cache record' };
    record.self = record;
    const parsed = parse(stringify(record));
    expect(parsed.label).toBe('cache record');
    expect(parsed.self).toBe(parsed);
  });

  it('keeps authored menu anchors and text while removing executable menu markup', () => {
    const menu = document.createElement('div');
    menu.innerHTML = DOMPurify.sanitize(
      '<nav><a href="#author-heading" class="menu-link">Author heading</a><a href="javascript:alert(1)">Unsafe link</a><img src="/local.png" onerror="alert(1)"><script>alert(1)</script></nav>'
    );
    expect(menu.querySelector('a')).toHaveAttribute('href', '#author-heading');
    expect(menu.querySelector('a')).toHaveTextContent('Author heading');
    expect(menu.querySelector('a')).toHaveClass('menu-link');
    expect(menu.querySelector('img')).toHaveAttribute('src', '/local.png');
    expect(menu.querySelector('[onerror], script, [href^="javascript:"]')).toBeNull();
  });

  it.each([
    ['flowchart', 'flowchart TD\n  Author[Author heading] --> Article[Article body]'],
    ['sequence', 'sequenceDiagram\n  Reader->>Blog: Open article\n  Blog-->>Reader: Author content'],
  ])('parses supported authored %s diagrams with the real Mermaid package', async (_name, source) => {
    await expect(mermaid.parse(source)).resolves.toBeTruthy();
  });
});
