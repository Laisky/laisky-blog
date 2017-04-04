import json
import urllib

import tornado
from bson import ObjectId

from gargantua.utils import debug_wrapper, logger, is_objectid
from gargantua.models.articles import ArticlesModel
from .base import APIHandler
from .filters import OidSortFilter, LimitFilter, SkitFilter
from .query_makers import PostCategoiesFilterMaker
from .parsers import PostContentTruncateParser, PostContentParser


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
    _parsers = (PostContentParser, PostContentTruncateParser,)
    _query_makers = (PostCategoiesFilterMaker,)

    def get_oidname(self):
        return 'post_name'
