#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging

import pymongo
import tornado
from bson import ObjectId

from ..utils import debug_wrapper, BaseHandler
from ..const import LOG_NAME


log = logging.getLogger(LOG_NAME)


class PostsHandler(BaseHandler):
    """APIs about posts"""

    @tornado.web.asynchronous
    def get(self, url):
        log.info('PostsHandler get {}'.format(url))

        router = {
            'get-lastest-posts': self.get_lastest_posts,
            'get-post-by-id': self.get_post_by_id,
        }
        router.get(url, self.redirect_404)()

    @tornado.gen.coroutine
    @debug_wrapper
    def get_lastest_posts(self):
        log.debug('get_lastest_posts')

        n = int(self.get_argument('n', strip=True, default=5))

        cursor = self.db.posts.find({}, {'_id': 1})
        cursor.sort([('_id', pymongo.DESCENDING)]).limit(n)
        post_ids = []
        for docu in (yield cursor.to_list(length=n)):
            post_ids.append(str(docu['_id']))

        _ids = ';'.join(post_ids)
        self.write_json(data=_ids)
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def get_post_by_id(self):
        log.debug('get_post_by_id')

        is_full = self.get_argument('is_full', strip=True, default=True)
        _id = self.get_argument('id', strip=True)

        docu = yield self.db.posts.find_one({'_id': ObjectId(_id)})
        if docu:
            docu['post_created_gmt'] = \
                docu['_id'].generation_time.timestamp() * 1000
            docu['_id'] = str(docu['_id'])
            docu['post_modified_gmt'] = \
                docu['post_modified_gmt'].timestamp() * 1000

        self.write_json(data=docu)
        self.finish()
