import DOMPurify from 'dompurify';

const ARTICLE_TAGS = [
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
  'var',
];
const ARTICLE_ATTRIBUTES = [
  'alt',
  'class',
  'colspan',
  'data-series-key',
  'height',
  'href',
  'id',
  'key',
  'loading',
  'rel',
  'reversed',
  'rowspan',
  'scope',
  'src',
  'start',
  'target',
  'title',
  'width',
];

/**
 * sanitizeArticleHtml converts untrusted article or menu HTML into inert formatting.
 * It accepts an HTML string and returns sanitized HTML, preserving series metadata
 * and HTTP(S), relative, email, and telephone links while excluding active resources.
 */
export function sanitizeArticleHtml(html) {
  const fragment = DOMPurify.sanitize(typeof html === 'string' ? html : '', {
    ALLOWED_TAGS: ARTICLE_TAGS,
    ALLOWED_ATTR: ARTICLE_ATTRIBUTES,
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  for (const element of fragment.querySelectorAll('[href], [src]')) {
    for (const attribute of ['href', 'src']) {
      const value = element.getAttribute(attribute);
      if (value === null) continue;
      let protocol;
      try {
        protocol = new URL(value, 'https://article.invalid/').protocol;
      } catch {
        element.removeAttribute(attribute);
        continue;
      }
      const allowed = ['http:', 'https:'];
      if (attribute === 'href') allowed.push('mailto:', 'tel:');
      if (!allowed.includes(protocol)) element.removeAttribute(attribute);
    }
    if (element.getAttribute('target') === '_blank') element.setAttribute('rel', 'noopener noreferrer');
  }
  const container = document.createElement('div');
  container.appendChild(fragment);
  return container.innerHTML;
}

/** escapeArticleText accepts an untrusted value and returns escaped text for generated series HTML. */
export function escapeArticleText(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]
  );
}
