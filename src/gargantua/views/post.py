#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging
import urllib

import tornado

from .base import BaseHandler
from ..const import LOG_NAME
from ..utils import debug_wrapper


log = logging.getLogger(LOG_NAME)


class PostPage(BaseHandler):

    @tornado.gen.coroutine
    @debug_wrapper
    def get(self, name):
        log.info('GET PostPage for name {}'.format(name))

        name = urllib.parse.quote(name).lower()
        post = yield self.db.posts.find_one({'post_name': name})
        self.render2('p/index.html', posts=[post])


class MainPage(BaseHandler):
    pass


class AboutMe(BaseHandler):
    pass
