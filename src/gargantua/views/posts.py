#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging

import pymongo
import tornado

from ..utils import debug_wrapper, BaseHandler
from ..const import LOG_NAME


log = logging.getLogger(LOG_NAME)


class PostsHandler(BaseHandler):

    @tornado.web.asynchronous
    def get(self, url):
        log.info('PostsHandler get {}'.format(url))

        router = {
            'get-lastest-posts': self.get_lastest_posts,
        }
        router.get(url, self.redirect_404)()

    @tornado.gen.coroutine
    @debug_wrapper(log)
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
