import logging
import json

import tornado
import html2text

from gargantua.const import LOG_NAME
from gargantua.utils import AuthHandlerMixin, DbHandlerMixin, WebHandlerMixin


logger = logging.getLogger(LOG_NAME)


class BaseApiHandler(tornado.web.RequestHandler,
                     AuthHandlerMixin,
                     DbHandlerMixin,
                     WebHandlerMixin):

    def rest_write(self, data):
        # TODO 根据 meta 来返回 HTML， JSON 和 XML
        self.write_json(data)
        self.finish()

    def write_json(self, data):
        logger.debug('Resp: {}'.format(data))
        self.write(json.dumps(data))

    def truncate_content(self, content, truncate):
        if truncate:
            return content[: truncate]
        else:
            return content

    def plaintext_content(self, content):
        return html2text.html2text(content)

    def hyperlink_postname(self, post_name):
        return 'http://blog.laisky.com/api/p/{}/'.format(post_name)
