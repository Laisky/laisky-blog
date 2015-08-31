"""Use Markdown2 to render github flavor markdown to html
"""

import re

import markdown2


H1_REG = re.compile(r'<h1>(.+)</h1>')
H2_REG = re.compile(r'<h2>(.+)</h2>')
H3_REG = re.compile(r'<h3>(.+)</h3>')


def render_md_to_html(content):
    html = markdown2.markdown(content, extras=['fenced-code-blocks', 'footnotes', 'tables'])
    _s = '<div class="highlight">{}</div>'.format(html)
    _s = H1_REG.sub(r'<h1 id="\1">\1</h1>', _s)
    _s = H2_REG.sub(r'<h2 id="\1">\1</h2>', _s)
    _s = H3_REG.sub(r'<h3 id="\1">\1</h3>', _s)
    return _s
