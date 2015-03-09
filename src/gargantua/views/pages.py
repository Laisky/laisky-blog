#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging
import tornado

from ..const import LOG_NAME
from ..utils import BaseHandler, debug_wrapper


log = logging.getLogger(LOG_NAME)


class ArticlesPage(BaseHandler):

    @tornado.web.asynchronous
    def get(self, url=None):
        log.info('ArticlesPage GET for url {}'.format(repr(url)))

        url = url or 'index'
        router = {
            'index': self.index,
            'get-post-by-name': self.get_post_by_name
        }
        router.get(url, self.redirect_404)()

    def index(self):
        self.render('articles.html')
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def get_post_by_name(self):
        name = self.get_argument('name', strip=True)
        log.debug('get_post_by_name for name {}'.format(name))

        post = yield self.db.posts.find_one({'post_name': name})
        _posts = self.render_template('post.html', posts=[post])
        self.write_json(data=_posts)
        self.finish()


class MainPage(BaseHandler):
    pass


class AboutMe(BaseHandler):
    pass


class PostPage(BaseHandler):
    pass
