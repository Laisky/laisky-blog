#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging
from math import ceil

import tornado

from gargantua.const import LOG_NAME, N_POST_PER_PAGE
from gargantua.utils import DbHandlerMixin, WebHandlerMixin, \
    AuthHandlerMixin, JinjaMixin


log = logging.getLogger(LOG_NAME)
__all__ = ['BaseHandler']


class BaseHandler(WebHandlerMixin,
                  JinjaMixin,
                  DbHandlerMixin,
                  AuthHandlerMixin,
                  tornado.web.RequestHandler,):

    def get(self, url=None):
        url = url.strip(' /')
        super().get(url)

    @tornado.gen.coroutine
    def prepare(self):
        super().prepare()
        cursor = self.db.posts.find()
        self.post_count = yield cursor.count()
        self.max_page = ceil(self.post_count / N_POST_PER_PAGE)
        log.debug('prepare for post_count {}, max_page {}'
                  .format(self.post_count, self.max_page))

    def render_post(self, template_name, **kwargs):
        kwargs.update({
            'max_page': self.max_page,
        })
        self.render2(template_name, **kwargs)
