#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging
from math import ceil

import pymongo
import tornado
import html2text
from bson import ObjectId

from ..utils import debug_wrapper, BaseHandler, unquote_fr_mongo
from ..const import LOG_NAME, N_POST_PER_PAGE


log = logging.getLogger(LOG_NAME)


class PostsBaseHandler(BaseHandler):

    @tornado.gen.coroutine
    def prepare(self):
        super().prepare()
        cursor = self.db.posts.find()
        self.post_count = yield cursor.count()
        self.max_page = ceil(self.post_count / N_POST_PER_PAGE)

    def render_post(self, template_name, **kwargs):
        kwargs.update({
            'max_page': self.max_page,
        })
        super().render2(template_name, **kwargs)


class PostsHandler(PostsBaseHandler):
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
        is_full = self.get_argument('is_full', strip=True, default=False)
        log.debug('get_lastest_posts for since_name {}'
                  .format(since_name))

        n = N_POST_PER_PAGE
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
