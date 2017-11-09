"""Use Markdown2 to render github flavor markdown to html
"""

import re
from collections import OrderedDict

import markdown2


TITLE_REG = re.compile(r'(<(h[23]).{0,}>(.+)</\2>)')
CHINESE_SERIAL = {
    '0': '〇',
    '1': '一',
    '2': '二',
    '3': '三',
    '4': '四',
    '5': '五',
    '6': '六',
    '7': '七',
    '8': '八',
    '9': '九',
}


def convert2chn_serial(number):
    return ''.join(map(lambda n: CHINESE_SERIAL[n], str(int(number))))


def render_md_to_html(content, is_extract_menu=False):
    html = markdown2.markdown(content, extras=['fenced-code-blocks', 'footnotes', 'tables'])
    html = '<div>{}</div>'.format(html)
    html = TITLE_REG.sub(r'<\2 id="\3">\3</\2>', html)
    html = html.replace('class="codehilite"', 'class="codehilite highlight"')
    h2_count = h3_count = 1
    if is_extract_menu:
        title_menu = TitleMenu()
        for cont, level, title in TITLE_REG.findall(html):
            title_menu.add_title(level, title)
            if level == 'h2':  # 给 h2 添加中文序号
                serial = convert2chn_serial(h2_count)
                h2_count += 1
                h3_count = 1
            elif level == 'h3':  # 给 h3 添加序号
                serial = '{}'.format(h3_count)
                h3_count += 1

            new_title = '<{level} id="{title}">{serial}、{title}</{level}>'\
                .format(level=level, title=title, serial=serial)
            html = html.replace(cont, new_title)

        return html, title_menu.render()
    else:
        return html


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
