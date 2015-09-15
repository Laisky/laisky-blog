"""Use Markdown2 to render github flavor markdown to html
"""

import re
from collections import OrderedDict

import markdown2


TITLE_REG = re.compile(r'<(h[23]).{0,}>(.+)</\1>')


def render_md_to_html(content, is_extract_menu=False):
    html = markdown2.markdown(content, extras=['fenced-code-blocks', 'footnotes', 'tables'])
    _s = '<div class="highlight">{}</div>'.format(html)
    _s = TITLE_REG.sub(r'<\1 id="\2">\2</\1>', _s)
    if is_extract_menu:
        title_menu = TitleMenu()
        for level, title in TITLE_REG.findall(_s):
            title_menu.add_title(level, title)

        return _s, title_menu.render()
    else:
        return _s


class TitleMenu():

    """提取 H2 和 H3 生成 bootstrap affix 的目录结构"""

    MENU_TMPL = '<ul class="nav affix-top" data-spy="affix">\n{menu_content}</ul>\n'
    CHILD_MENU_TMPL = '<ul class="nav">\n{child_menu}</ul>\n'
    TITLE_TMPL = '<li><a href="#{title}">{title}</a>\n{content}</li>\n'

    def __init__(self):
        self.title_tree = OrderedDict()

    def add_title(self, level, title):
        if level == 'h2':
            self.last_key = title
            self.title_tree.update({title: []})
        elif level == 'h3':
            self.title_tree[self.last_key].append(title)

    def render(self):
        if not len(self.title_tree):
            return ''

        menu_content = ''
        for title, content in self.title_tree.items():
            if not content:
                # 该 h2 节点没有子目录
                menu_content += self.TITLE_TMPL.format(title=title, content='')
            else:
                # 该 h2 节点有子目录
                child_menu = ''.join([self.TITLE_TMPL.format(title=child, content='') for child in content])
                child_content = self.CHILD_MENU_TMPL.format(child_menu=child_menu)
                menu_content += self.TITLE_TMPL.format(title=title, content=child_content)

        return self.MENU_TMPL.format(menu_content=menu_content)
