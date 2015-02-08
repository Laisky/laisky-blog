#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging

import pymongo
import tornado

from .base import BaseHandler
from ..models import post_render
from ..utils.tornado import debug_wrapper


log = logging.getLogger(__name__)


class PostsHandler(BaseHandler):

    @tornado.web.asynchronous
    def get(self, url):
        log.info('PostsHandler get {}'.format(url))

        router = {
            'api/get-lastest-posts': self.get_lastest_posts,
        }
        router.get(url, self.redirect_404)()

    @tornado.gen.coroutine
    @debug_wrapper(log)
    def get_lastest_posts(self):
        log.info('get_lastest_posts')

        n = int(self.get_argument('n', strip=True, default=5))

        cursor = self.db.posts.find()
        cursor.sort([('_id', pymongo.DESCENDING)]).limit(n)
        posts = []
        for docu in (yield cursor.to_list(length=n)):
            posts.append(post_render(docu))

        self.write_json(data=posts)
        self.finish()
