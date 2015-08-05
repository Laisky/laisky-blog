import logging

import pymongo
import tornado
from bson import ObjectId

from gargantua.utils import debug_wrapper, utc2cst, dt2timestamp, \
    is_objectid
from gargantua.const import LOG_NAME
from .base import BaseApiHandler


logger = logging.getLogger(LOG_NAME)
convert_dt = lambda dt: dt2timestamp(utc2cst(dt))


class PostApiHandler(BaseApiHandler):

    def parse_docu(self, docu, truncate=None, plaintext=False):
        content = docu['post_content']
        if docu.get('post_password'):
            content = ''
        else:
            if plaintext:
                content = self.plaintext_content(content)
            if truncate:
                content = self.truncate_content(content, truncate)

        return {
            'post_title': docu['post_title'],
            'link': self.hyperlink_postname(docu['post_name']),
            'post_name': docu['post_name'],
            'post_content': content,
            'post_id': str(docu['_id']),
            'post_author': str(docu['post_author']),
            'post_modified_gmt': convert_dt(docu['post_modified_gmt']),
            'post_created_at': convert_dt(docu['post_created_at']),
            'post_status': docu['post_status'],
        }

    @tornado.web.asynchronous
    def get(self, pid=None):
        if not pid:
            self.list()
        else:
            self.retrieve(pid)

    @tornado.gen.coroutine
    @debug_wrapper
    def retrieve(self, pid):
        if is_objectid(pid):
            docu = yield self.db.posts.find_one({'_id': ObjectId(pid)})
        else:
            docu = yield self.db.posts.find_one({'post_name': pid})

        parsed_docu = self.parse_docu(docu)
        self.rest_write(parsed_docu)

    @tornado.gen.coroutine
    @debug_wrapper
    def list(self):
        try:
            sort = self.get_argument('sort', default='des', strip=True)
            limit = int(self.get_argument('limit', default='15', strip=True))
            skip = int(self.get_argument('skip', default='0', strip=True))
            plaintext = self.get_argument('plaintext', default='false', strip=True)
            truncate = int(self.get_argument('truncate', default='0', strip=True))
            assert(sort in ['des', 'asc'])
            assert(limit > 0)
            assert(skip >= 0)
            assert(plaintext in ['true', 'false'])
            assert(truncate >= 0)
        except (ValueError, AssertionError):
            self.http_400_bad_request('Arguments Error!')
            return
        else:
            plaintext = plaintext == 'true'

        logger.debug(
            'GET PostsHandler for sort {}, limit {}, skip {}, plaintext {}, '
            'truncate {}, '
            .format(sort, limit, skip, plaintext, truncate))
        cursor = self.db.posts.find()
        if sort == 'des':
            cursor.sort([('_id', pymongo.DESCENDING)])
        elif sort == 'asc':
            cursor.sort([('_id', pymongo.ASCENDING)])

        cursor.limit(limit).skip(skip)
        posts = []
        while (yield cursor.fetch_next):
            docu = cursor.next_object()
            parsed_docu = self.parse_docu(
                docu, truncate=truncate, plaintext=plaintext
            )
            posts.append(parsed_docu)

        resp = {
            'length': len(posts),
            'sort': sort,
            'limit': limit,
            'skip': skip,
            'plaintext': plaintext,
            'truncate': truncate,
            'results': posts
        }
        self.rest_write(resp)
