#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging

import pymongo
import tornado
import html2text
from bson import ObjectId

from ..utils import debug_wrapper, BaseHandler, unquote_fr_mongo
from ..const import LOG_NAME, N_MAX_POSTS


log = logging.getLogger(LOG_NAME)


class PostsHandler(BaseHandler):
    """APIs about posts"""

    @tornado.web.asynchronous
    def get(self, url):
        log.info('PostsHandler get {}'.format(url))

        router = {
            'get-lastest-posts-by-name': self.get_lastest_posts_by_name,
            'get-post-by-id': self.get_post_by_id,
        }
        router.get(url, self.redirect_404)()

    @tornado.gen.coroutine
    @debug_wrapper
    def get_lastest_posts_by_name(self):
        since_name = self.get_argument('since_name', strip=True)
        n = int(self.get_argument('n', strip=True, default=5))
        is_full = self.get_argument('is_full', strip=True, default=False)
        log.debug('get_lastest_posts for n {}, since_name {}'
                  .format(n, since_name))

        n = min(n, N_MAX_POSTS)

        since_id = (yield
                    self.db.posts.find_one({'post_name': since_name}))['_id']
        cursor = self.db.posts.find({'_id': {'$lt': since_id}})
        cursor.sort([('_id', pymongo.DESCENDING)]).limit(n)
        posts = []
        for docu in (yield cursor.to_list(length=n)):
            if docu['post_password']:
                continue

            docu = unquote_fr_mongo(docu)
            if not is_full:
                content = html2text.html2text(docu['post_content'])
                docu['post_content'] = content[: 1000]

            posts.append(docu)

        _posts = self.render_template('widgets/post.html', posts=posts)
        self.write_json(data=_posts)
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def get_post_by_id(self):
        is_full = self.get_argument('is_full', strip=True, default=False)
        _id = self.get_argument('id', strip=True)
        log.debug('get_post_by_id for _id {}, is_full {}'.format(_id, is_full))

        docu = yield self.db.posts.find_one({'_id': ObjectId(_id)})
        if docu:
            docu['post_created_gmt'] = \
                docu['_id'].generation_time.timestamp() * 1000
            docu['_id'] = str(docu['_id'])
            docu['post_modified_gmt'] = \
                docu['post_modified_gmt'].timestamp() * 1000
            if not is_full:
                docu['post_content'] = docu['post_content'][: 1000]

        self.write_json(data=docu)
        self.finish()
