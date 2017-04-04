import json
import urllib

import tornado
from bson import ObjectId

from gargantua.utils import debug_wrapper, logger, is_objectid
from gargantua.models.articles import ArticlesModel
from .base import APIHandler
from .filters import OidSortFilter, LimitFilter, SkitFilter
from .query_makers import PostCategoiesFilterMaker
from .parsers import PostContentTruncateParser


class PostCategoriesAPIHandler(APIHandler):
    _collection = 'categories'
    _filters = (OidSortFilter, LimitFilter, SkitFilter)

    @tornado.gen.coroutine
    @debug_wrapper
    def retrieve(self, oid):
        if not is_objectid(oid):
            docu = yield self.db.categories.find_one({'name': urllib.parse.unquote(oid)})
            if docu:
                oid = str(docu['_id'])

        super().retrieve(oid)

    @tornado.web.authenticated
    @tornado.gen.coroutine
    @debug_wrapper
    def put(self, category=None):
        try:
            categories = self.get_argument('categories', strip=True)
            categories = json.loads(categories)
        except Exception as err:
            self.http_400_bad_request(err=err)
            return

        logger.debug('PostCategoriesAPIHandler PUT for categories %s', categories)
        yield ArticlesModel.update_posts_categories(categories)


class PostAPIHandler(APIHandler):

    _collection = 'posts'
    _filters = (OidSortFilter, LimitFilter, SkitFilter)
    _parsers = (PostContentTruncateParser,)
    _query_makers = (PostCategoiesFilterMaker,)

    @tornado.gen.coroutine
    @debug_wrapper
    def parse_docu(self, docu, plaintext=False):
        docus = super().parse_docus([docu])
        if not docus:
            return

        docu = docus[0]
        content = docu['post_content']
        if docu.get('post_password'):
            content = ''
        else:
            if plaintext:
                content = self.plaintext_content(content)

        if 'category' in docu:
            category = (yield self.db.categories.find_one({'_id': ObjectId(docu['category'])})) or {}
        else:
            category = {}

        raise tornado.gen.Return({
            'post_tags': docu.get('post_tags', []),
            'post_category': category.get('name'),
            'post_title': docu['post_title'],
            'post_type': docu.get('post_type', 'markdown'),
            'link': self.hyperlink_postname(docu['post_name']),
            'post_name': docu['post_name'],
            'post_markdown': docu.get('post_markdown'),
            'post_menu': docu.get('post_menu'),
            'post_content': content,
            'post_id': str(docu['_id']),
            'post_author': str(docu['post_author']),
            'post_modified_gmt': docu['post_modified_gmt'],
            'post_created_at': docu['post_created_at'],
            'post_status': docu['post_status'],
        })

    @tornado.gen.coroutine
    @debug_wrapper
    def list(self):
        logger.info('PostAPIHandler list')

        try:
            plaintext = self.get_argument('plaintext', default='false', strip=True)
            assert(plaintext in ['true', 'false'])
        except (ValueError, AssertionError) as err:
            logger.exception(err)
            self.http_400_bad_request(err=err)
            return
        else:
            plaintext = plaintext == 'true'

        cursor = yield self.get_cursor()
        if not cursor:
            return

        posts = []
        while (yield cursor.fetch_next):
            docu = cursor.next_object()
            parsed_docu = yield self.parse_docu(docu, plaintext=plaintext)
            posts.append(parsed_docu)

        col = self.get_col()
        total = yield col.count()
        self.success(posts, total=total)

    def get_oidname(self):
        return 'post_name'
