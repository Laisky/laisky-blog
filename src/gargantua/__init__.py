#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""Gargantua

Author : Laisky
EMail  : ppcelery@gmail.com
Home   : https://github.com/Laisky/laisky-blog
"""

import logging
from pathlib import Path

import tornado.wsgi
import tornado.web
from tornado.options import define, options
import motor

from .const import CWD, DB_HOST, DB_PORT, LISTEN_PORT, DB_NAME, \
    LOG_PATH, LOG_NAME
from .utils import setup_log, BaseHandler
from .views import PostsHandler, ArticlesPage


log = logging.getLogger(LOG_NAME)
setup_log(LOG_NAME, LOG_PATH)
define('port', default=LISTEN_PORT, type=int)
define('debug', default=False, type=bool)
define('dbname', default=DB_NAME, type=str)
define('dbhost', default=DB_HOST, type=str)
define('dbport', default=DB_PORT, type=int)


class PageNotFound(BaseHandler):

    def get(self, url=''):
        self.render('404.html', url=url)
        self.finish()


class Application(tornado.wsgi.WSGIApplication):

    def __init__(self):
        settings = {
            'static_path': str(Path(CWD, 'static')),
            'static_url_prefix': '/static/',
            'template_path': str(Path(CWD, 'static', 'templates')),
            'cookie_secret': 'XmuwPAt8wHdnik4Xvc3GXmbXLifVmPZYhoc9Tx4x1iZ',
            'login_url': '/login/',
            'xsrf_cookies': True,
            'autoescape': None,
            'debug': options.debug
        }
        handlers = [
            # -------------- handler --------------
            ('/articles', ArticlesPage),
            # ---------------- api ----------------
            ('/api/posts/(.*)', PostsHandler),
            # ---------------- 404 ----------------
            ('/404.html', PageNotFound),
        ]
        handlers.append(('/(.*)', PageNotFound))
        super(Application, self).__init__(handlers, **settings)
        self.setup_db()

    def setup_db(self):
        log.debug('connect dabase at {}:{}'
                  .format(options.dbhost, options.dbport))

        self.conn = motor.MotorClient(host=options.dbhost, port=options.dbport)
        self.db = self.conn[options.dbname]
