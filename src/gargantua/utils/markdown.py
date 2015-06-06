"""Use Markdown2 to render github flavor markdown to html
"""

import markdown2


def render_md_to_html(content):
    html = markdown2.markdown(content, extras=['fenced-code-blocks', 'footnotes'])
    return '<div class="highlight">{}</div>'.format(html)
