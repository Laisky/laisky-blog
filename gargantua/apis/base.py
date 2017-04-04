import json
import urllib

import tornado
import html2text
import dicttoxml

from gargantua.utils import AuthHandlerMixin, DbHandlerMixin, \
    WebHandlerMixin, HttpErrorMixin, JinjaMixin, RFCMixin, \
    MongoParser, debug_wrapper, logger
from .filters import FilterError, \
    OidSortFilter, SkitFilter, LimitFilter
from .query_makers import QueryMakerError
from .parsers import ParserError, DatetimeParser, MongoDataParser


class BaseAPIHandler(AuthHandlerMixin,
                     JinjaMixin,
                     RFCMixin,
                     DbHandlerMixin,
                     WebHandlerMixin,
                     HttpErrorMixin,
                     tornado.web.RequestHandler):

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
        logger.debug('Resp: {}'.format(str(data)[: 50]))
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
        return 'https://blog.laisky.com/p/{}/'.format(post_name)

mongo_parser = MongoParser()


class APIHandler(BaseAPIHandler):

    """API Handler

    query_maker -> db -> filters -> parsers -> client
    """

    _collection = None
    _base_filters = (OidSortFilter, LimitFilter, SkitFilter)
    _base_query_makers =tuple()
    _base_parsers =(DatetimeParser, MongoDataParser)

    @tornado.web.asynchronous
    def get(self, oid=None):
        if oid:
            return self.retrieve(oid)
        else:
            return self.list()

    @tornado.gen.coroutine
    @debug_wrapper
    def parse_docus(self, docus):
        try:
            for p in (getattr(self, '_parsers', tuple()) + self._base_parsers):
                docus = yield p.parse_results(self, docus)
        except ParserError as err:
            logger.debug(err)
            self.http_400_bad_request(err=err)
            return None

        raise tornado.gen.Return(docus)

    def get_col(self):
        assert self._collection, 'You must identify _collecion'
        return getattr(self.db, self._collection)

    @tornado.gen.coroutine
    @debug_wrapper
    def get_cursor(self):
        col = self.get_col()
        query, projection = yield self.pass_query_makers()
        if query is None:
            logger.debug('not get query')
            return

        cursor = col.find(query, projection)
        raise tornado.gen.Return(self.pass_filter(cursor))

    @tornado.gen.coroutine
    @debug_wrapper
    def pass_query_makers(self):
        query, projection = {}, None
        try:
            for qm in (getattr(self, '_query_makers', tuple()) + self._base_query_makers):
                query, projection = yield qm.update_query(self, query, projection)

        except QueryMakerError as err:
            logger.debug(err)
            self.http_400_bad_request(err=err)
            return None, None

        raise tornado.gen.Return((query, projection))

    def pass_filter(self, cursor):
        for f in (getattr(self, '_filters', tuple()) + self._base_filters):
            try:
                cursor = f.query_cursor(self, cursor)
            except FilterError as err:
                logger.debug(err)
                self.http_400_bad_request(err=err)
                return

        return cursor

    def get_oidname(self):
        return '_id'

    def parse_oid(self, oid):
        return urllib.parse.quote(oid).lower()

    @tornado.gen.coroutine
    @debug_wrapper
    def retrieve(self, oid):
        logger.info('retrieve {} for oid {}'
                    .format(self._collection, oid))
        col = self.get_col()
        oidname = self.get_oidname()
        try:
            f_oid = self.parse_oid(oid)
            docu = yield col.find_one({oidname: f_oid})
            assert docu, 'article not exists!'
        except Exception as err:
            self.http_404_not_found(err=err)
            return

        parsed_docu = yield self.parse_docus([docu])
        if not parsed_docu:
            return

        self.success(parsed_docu[0])

    @tornado.gen.coroutine
    @debug_wrapper
    def list(self):
        cursor = yield self.get_cursor()
        if not cursor:
            return

        posts = []
        while (yield cursor.fetch_next):
            docu = cursor.next_object()
            post = mongo_parser.parse(docu)
            posts.append(post)

        col = self.get_col()
        total = yield col.count()
        parsed_docus = yield self.parse_docus(posts)
        if not parsed_docus:
            return None

        self.success(parsed_docus, total=total)
