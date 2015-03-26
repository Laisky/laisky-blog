#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging
import urllib

import pymongo
import tornado
import html2text

from ..const import LOG_NAME, N_MAX_POSTS
from ..utils import BaseHandler, debug_wrapper, unquote_fr_mongo


log = logging.getLogger(LOG_NAME)


class ArchivesPage(BaseHandler):

    @tornado.gen.coroutine
    @debug_wrapper
    def get(self):
        log.info('ArchivesPage GET')

        n = int(self.get_argument('n', strip=True, default=5))
        is_full = self.get_argument('is_full', strip=True, default=False)
        ajax = self.get_argument('ajax', strip=True, default="html")
        log.debug('get for n {}, is_full {}, ajax {}'.format(n, is_full, ajax))

        n = min(n, N_MAX_POSTS)
        cursor = self.db.posts.find({})
        cursor.sort([('_id', pymongo.DESCENDING)]).limit(n)
        posts = []
        for docu in (yield cursor.to_list(length=n)):
            docu = unquote_fr_mongo(docu)
            if not is_full:
                content = html2text.html2text(docu['post_content'])
                docu['post_content'] = content[: 1000]

            posts.append(docu)

        if ajax == 'html':
            self.render('archives/index.html', posts=posts)
        elif ajax == 'body':
            self.render('archives/ajax/body.html', posts=posts)

        self.finish()


class PostPage(BaseHandler):

    @tornado.gen.coroutine
    @debug_wrapper
    def get(self, name):
        log.info('PostPage GET for name {}'.format(name))

        name = urllib.parse.quote(name).lower()
        post = yield self.db.posts.find_one({'post_name': name})
        self.render('p/index.html', posts=[post])


class MainPage(BaseHandler):
    pass


class AboutMe(BaseHandler):
    pass
