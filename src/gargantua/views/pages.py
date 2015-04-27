#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging
import urllib

import pymongo
import tornado
import html2text

from ..const import LOG_NAME, N_POST_PER_PAGE
from ..utils import BaseHandler, debug_wrapper, unquote_fr_mongo


log = logging.getLogger(LOG_NAME)


class ArchivesPage(BaseHandler):

    @tornado.gen.coroutine
    @debug_wrapper
    def get(self):
        log.info('ArchivesPage GET')

        is_full = self.get_argument('is_full', strip=True, default=False)
        ajax = self.get_argument('ajax', strip=True, default="html")
        page = int(self.get_argument('page', strip=True))
        log.debug('get for is_full {}, ajax {}, page {}'
                  .format(is_full, ajax, page))

        n = N_POST_PER_PAGE
        skip = (page - 1) * N_POST_PER_PAGE
        cursor = self.db.posts.find()
        cursor.sort([('_id', pymongo.DESCENDING)]) \
            .limit(N_POST_PER_PAGE) \
            .skip(skip)
        posts = []
        for docu in (yield cursor.to_list(length=n)):
            if docu['post_password']:
                continue

            docu = unquote_fr_mongo(docu)
            if not is_full:
                content = html2text.html2text(docu['post_content'])
                docu['post_content'] = content[: 1000]

            posts.append(docu)

        if ajax == 'html':
            self.render_post('archives/index.html',
                             posts=posts, current_page=page)
        elif ajax == 'body':
            self.render_post('archives/ajax/body.html',
                             posts=posts, current_page=page)

        self.finish()


class PostPage(BaseHandler):

    @tornado.gen.coroutine
    @debug_wrapper
    def get(self, name):
        log.info('PostPage GET for name {}'.format(name))

        name = urllib.parse.quote(name).lower()
        post = yield self.db.posts.find_one({'post_name': name})
        self.render2('p/index.html', posts=[post])


class MainPage(BaseHandler):
    pass


class AboutMe(BaseHandler):
    pass
