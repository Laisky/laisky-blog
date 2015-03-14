#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging
import urllib

import tornado

from ..const import LOG_NAME
from ..utils import BaseHandler, debug_wrapper


log = logging.getLogger(LOG_NAME)


class ArchivesPage(BaseHandler):

    def get(self):
        log.info('ArchivesPage GET')
        self.render('archives/index.html')


class PostPage(BaseHandler):

    @tornado.gen.coroutine
    @debug_wrapper
    def get(self, name):
        log.debug('PostPage GET for name {}'.format(name))

        name = urllib.parse.quote(name).lower()
        post = yield self.db.posts.find_one({'post_name': name})
        self.render('p/index.html', posts=[post])


class MainPage(BaseHandler):
    pass


class AboutMe(BaseHandler):
    pass
