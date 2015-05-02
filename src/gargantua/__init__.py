#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""Gargantua

Author : Laisky
EMail  : ppcelery@gmail.com
Home   : https://github.com/Laisky/laisky-blog
"""

import logging
from pathlib import Path

import tornado
from tornado.web import url
from tornado.options import define, options
import motor
import pymongo

from .const import CWD, DB_HOST, DB_PORT, LISTEN_PORT, DB_NAME, LOG_NAME
from .utils import setup_log, generate_random_string
from .views import \
    BaseHandler, PostsHandler, PostPage, PublishHandler, UserHandler


log = logging.getLogger(LOG_NAME)
setup_log()
define('port', default=LISTEN_PORT, type=int)
define('debug', default=False, type=bool)
define('dbname', default=DB_NAME, type=str)
define('dbhost', default=DB_HOST, type=str)
define('dbport', default=DB_PORT, type=int)


class PageNotFound(BaseHandler):

    @tornado.gen.coroutine
    def get(self, url=None):
        if url is None:
            self.render2('404.html', url=url)
            self.finish()
            return

        self.redirect_404()


class Application(tornado.web.Application):

    def __init__(self):
        settings = {
            'static_path': str(Path(CWD, 'static')),
            'static_url_prefix': '/static/',
            'template_path': str(Path(CWD, 'templates')),
            'cookie_secret': generate_random_string(128),
            'token_secret': generate_random_string(128),
            'login_url': '/login/',
            'xsrf_cookies': True,
            'autoescape': None,
            'debug': options.debug
        }
        handlers = [
            # -------------- handler --------------
            url('/(archives)/', PostsHandler, name='post:archives'),
            url('/p/(.*)/', PostPage, name='post:single'),
            url('/publish/', PublishHandler, name='post:publish'),
            url('/(login)/', UserHandler, name='user:login'),
            # ---------------- api ----------------
            url('/api/posts/(.*)/', PostsHandler, name='api:post'),
            # ---------------- 404 ----------------
            url('/404.html', PageNotFound, name='404'),
        ]
        handlers.append(('/(.*)', PageNotFound))
        super(Application, self).__init__(handlers, **settings)
        self.setup_db()

    def setup_db(self):
        log.debug('connect dabase at {}:{}'
                  .format(options.dbhost, options.dbport))

        self.conn = motor.MotorClient(host=options.dbhost, port=options.dbport)
        self.db = self.conn[options.dbname]
        self.mongo_conn = pymongo.MongoClient(host=options.dbhost, port=options.dbport)
        self.mongo_db = self.mongo_conn[options.dbname]
