#!/usr/bin/env python
# -*- coding: utf-8 -*-
import tornado

from .base import BaseHandler
from ..const import ERROR
from ..utils import debug_wrapper, logger


class PostPage(BaseHandler):

    @tornado.gen.coroutine
    @debug_wrapper
    def get(self, name):
        logger.info('GET PostPage for name {}'.format(name))

        name = self.parse_post_name(name)
        post = yield self.db.posts.find_one({'post_name': name})
        if not post:
            self.redirect_404()
            return

        if post.get('post_password'):
            cookie_name = self.get_cookie_name(name)
            cookie = self.get_secure_cookie(cookie_name)
            logger.debug('get cookie {}'.format(cookie))
            if not cookie or cookie.decode() != post['post_password']:
                self.render2('p/auth.html', post_name=post['post_name'])
                self.set_status(202, 'Need password.')
                return

        post['post_type'] = post.get('post_type', 'text')
        self.render2('p/index.html', post=post)

    @tornado.gen.coroutine
    @debug_wrapper
    def post(self, name):
        logger.info("POST PostPage with name {}".format(name))

        name = self.parse_post_name(name)
        password = self.get_argument('password', strip=True)
        logger.debug('POST PostPage for name {}, password {}'
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
