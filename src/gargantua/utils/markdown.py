"""Use Markdown2 to render github flavor markdown to html
"""

import re

import markdown2


TITLE_REG = re.compile(r'<(h[123])>(.+)</\1>')


def render_md_to_html(content):
    html = markdown2.markdown(content, extras=['fenced-code-blocks', 'footnotes', 'tables'])
    _s = '<div class="highlight">{}</div>'.format(html)
    _s = TITLE_REG.sub(r'<\1 id="\2">\2</\1>', _s)
    return _s
