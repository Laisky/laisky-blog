import json
import urllib

import tornado
import html2text
import dicttoxml
from bson import ObjectId

from gargantua.utils import AuthHandlerMixin, DbHandlerMixin, \
    WebHandlerMixin, HttpErrorMixin, JinjaMixin, RFCMixin, \
    MongoParser, debug_wrapper, logger
from .filters import FilterError, \
    OidSortFilter, SkitFilter, LimitFilter


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
                logger.debug('_get_resp_method {}'.format(m))
                return m

        logger.debug('_get_resp_method fail')
        return self.write_not_accept

    def success(self, data, **kwargs):
        resp = {'status': 'ok', 'result': data}
        resp.update(kwargs)
        self.rest_write(resp)

    def fail(self, data, **kwargs):
        resp = {'status': 'fail', 'result': data}
        resp.update(kwargs)
        self.rest_write(resp)

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

mongo_parser = MongoParser()


class ApiHandler(BaseApiHandler):

    _collection = None
    _filters = (OidSortFilter, LimitFilter, SkitFilter)

    @tornado.web.asynchronous
    def get(self, oid=None):
        if oid:
            return self.retrieve(oid)
        else:
            return self.list()

    def parse_docu(self, docu):
        return docu

    def get_col(self):
        assert self._collection, 'You must identify _collecion'
        return getattr(self.db, self._collection)

    def get_cursor(self):
        col = self.get_col()
        cursor = col.find()
        return self.pass_filter(cursor)

    def pass_filter(self, cursor):
        for f in self._filters:
            fi = f()
            try:
                cursor = fi.query_cursor(self, cursor)
            except FilterError as err:
                logger.exception(err)
                self.http_400_bad_request(err=err)
                raise

        return cursor

    def get_oidname(self):
        return '_id'

    @tornado.gen.coroutine
    @debug_wrapper
    def retrieve(self, oid):
        logger.info('retrieve {} for oid {}'
                    .format(self._collection, oid))
        col = self.get_col()
        oidname = self.get_oidname()
        try:
            docu = yield col.find_one({oidname: oid})
            assert docu, 'article not exists!'
        except Exception as err:
            self.http_404_not_found(err=err)
            return

        parsed_docu = self.parse_docu(docu)
        self.success(parsed_docu)

    @tornado.gen.coroutine
    @debug_wrapper
    def list(self):
        cursor = self.get_cursor()
        posts = []
        while (yield cursor.fetch_next):
            docu = cursor.next_object()
            post = mongo_parser.parse(docu)
            posts.append(post)

        col = self.get_col()
        total = yield col.count()
        self.success(posts, total=total)
