#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging
import urllib

import tornado

from .base import BaseHandler
from ..const import LOG_NAME, ERROR
from ..utils import debug_wrapper, unquote_fr_mongo


log = logging.getLogger(LOG_NAME)


class PostPage(BaseHandler):

    @tornado.gen.coroutine
    @debug_wrapper
    def get(self, name):
        log.info('GET PostPage for name {}'.format(name))

        name = self.parse_post_name(name)
        post = yield self.db.posts.find_one({'post_name': name})
        if not post:
            self.redirect_404()
            return

        if post.get('post_password'):
            cookie_name = self.get_cookie_name(name)
            cookie = self.get_secure_cookie(cookie_name)
            log.debug('get cookie {}'.format(cookie))
            if not cookie or cookie.decode() != post['post_password']:
                self.render2('p/auth.html', post_name=post['post_name'])
                self.set_status(202, 'Need password.')
                return

        post = unquote_fr_mongo(post)
        post['post_type'] = post.get('post_type', 'text')
        self.render2('p/index.html', posts=[post])

    @tornado.gen.coroutine
    @debug_wrapper
    def post(self, name):
        log.info("POST PostPage with name {}".format(name))

        name = self.parse_post_name(name)
        password = self.get_argument('password', strip=True)
        log.debug('POST PostPage for name {}, password {}'
                  .format(name, password))

        post = yield self.db.posts.find_one({'post_name': name})
        if not post:
            self.set_status(202, 'Post name not exists.')
            self.write_json(msg='post_name 不存在', status=ERROR)
            return
        elif password != post['post_password']:
            self.set_status(202, 'Password wrong.')
            self.write_json(msg='密码错误', status=ERROR)
            return

        cookie_name = self.get_cookie_name(name)
        self.set_secure_cookie(cookie_name, password, expires_days=None)
        self.write_json(msg='ok')

    def parse_post_name(self, name):
        return urllib.parse.quote(name).lower()

    def get_cookie_name(self, post_name):
        return 'post.auth.{}'.format(post_name)
