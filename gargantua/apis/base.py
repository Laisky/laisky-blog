import logging
import json
import urllib

import tornado
import html2text
import dicttoxml

from gargantua.const import LOG_NAME
from gargantua.utils import AuthHandlerMixin, DbHandlerMixin, \
    WebHandlerMixin, HttpErrorMixin, JinjaMixin, RFCMixin


logger = logging.getLogger(LOG_NAME)


class BaseApiHandler(tornado.web.RequestHandler,
                     AuthHandlerMixin,
                     JinjaMixin,
                     RFCMixin,
                     DbHandlerMixin,
                     WebHandlerMixin,
                     HttpErrorMixin):

    def _get_accept_map(self):
        return {
            '*/*': self.write_json,
            'application/json': self.write_json,
            'plain/text': self.write_json,
            'application/x-www-form-urlencoded': self.write_encoded,
            'text/html': self.write_html,
            'application/xml': self.write_xml,
        }

    def _get_resp_method(self):
        _accept_map = self._get_accept_map()
        for accept in self.accept:
            m = _accept_map.get(accept.name)
            if m:
                return m

        return self.write_not_accept

    def rest_write(self, data):
        # TODO 根据 meta 来返回 HTML， JSON 和 XML
        resp_method = self._get_resp_method()
        resp_method(data)
        self.finish()

    def write_not_accept(self, data):
        logger.debug('write_not_accept for Accept: {}'.format(self.accept))
        _accept_map = self._get_accept_map()
        self.http_406_not_acceptable(
            'Only Accept {}! But Got {}'
            .format(list(_accept_map.keys()), self.accept)
        )

    def write_xml(self, data):
        resp = dicttoxml.dicttoxml(data)
        self.set_header('Content-Type', 'application/xml; charset=utf-8')
        self.write(resp)

    def write_html(self, data):
        resp = json.dumps(data, sort_keys=True, indent=4)
        self.set_header('Content-Type', 'text/html; charset=utf-8')
        self.render2('widgets/rest_response.html', response=resp)

    def write_json(self, data):
        logger.debug('Resp: {}'.format(data))
        resp = json.dumps(data)
        self.set_header('Content-Type', 'application/json; charset=utf-8')
        self.write(resp)

    def write_encoded(self, data):
        resp = urllib.parse.urlencode(data)
        self.set_header('Content-Type', 'application/x-www-form-urlencoded')
        self.write(resp)

    def write(self, data):
        self.set_header('Content-Length', len(data))
        super().write(data)

    def truncate_content(self, content, truncate):
        if truncate:
            return content[: truncate]
        else:
            return content

    def plaintext_content(self, content):
        return html2text.html2text(content)

    def hyperlink_postname(self, post_name):
        return 'http://blog.laisky.com/api/p/{}/'.format(post_name)
