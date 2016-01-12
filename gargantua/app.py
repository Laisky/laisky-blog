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
import pymongo
from tornado.web import url
from tornado.options import define, options

from gargantua.const import CWD, LISTEN_PORT, LOG_NAME, \
    DB_HOST, DB_PORT, DB_NAME, \
    MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWD, FROM_ADDR, TO_ADDRS, MAIL_SUBJECT
from gargantua.utils import setup_log, generate_random_string
from gargantua.views import BaseHandler, PostsHandler, \
    UserHandler, RssHandler, AmendHandler
from gargantua.apis import PostApiHandler
from gargantua.libs import LogMailHandler, LogMailFormatter
from gargantua.models import BaseBlogModel


# settings
define('port', default=LISTEN_PORT, type=int)
define('debug', default=False, type=bool)
# database
define('dbname', default=DB_NAME, type=str)
define('dbhost', default=DB_HOST, type=str)
define('dbport', default=DB_PORT, type=int)
# mail
define('mail_passwd', default=MAIL_PASSWD, type=str)

log = logging.getLogger(LOG_NAME)
setup_log()


class PageNotFound(BaseHandler):

    @tornado.gen.coroutine
    def get(self, url=None):
        log.debug('GET PageNotFound for url {}'.format(url))

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
            'cookie_secret': generate_random_string(50),
            'login_url': '/login/',
            'xsrf_cookies': True,
            'autoescape': None,
            'debug': options.debug
        }
        handlers = [
            # -------------- handler --------------
            url(r'^/(archives)/$', PostsHandler, name='post:archives'),
            url(r'^/(p)/(.*)/$', PostsHandler, name='post:single'),
            url(r'^/(publish)/$', PostsHandler, name='post:publish'),
            url(r'^/amend/$', AmendHandler, name='post:amend'),
            url(r'^/(login)/$', UserHandler, name='user:login'),
            url(r'^/(search)/$', PostsHandler, name='post:search'),
            url(r'^/(profile)/$', UserHandler, name='user:profile'),
            # ---------------- rss ----------------
            url(r'^/rss.xml$', RssHandler, name='rss'),
            # ---------------- old api ----------------
            url(r'^/(api/posts/.*)/$', PostsHandler, name='api:post'),
            url(r'^/(api/user/.*)/$', UserHandler, name='api:user:login'),
            # ---------------- rest api ----------------
            url(r'^/api/v2/p/([a-zA-Z]+)?/?$', PostApiHandler, name='rest:post'),
            # ---------------- 404 ----------------
            url(r'^/$', PostsHandler, name='root'),
            url(r'^/404.html$', PageNotFound, name='404'),
        ]
        handlers.append(('/(.*)', PageNotFound))
        self.setup_db()
        if not options.debug:
            self.setup_mail_handler()

        super(Application, self).__init__(handlers, **settings)

    def setup_mail_handler(self):
        # set mail handler
        mh = LogMailHandler(mailhost=(MAIL_HOST, MAIL_PORT),
                            fromaddr=FROM_ADDR,
                            toaddrs=TO_ADDRS,
                            credentials=(MAIL_USERNAME, options.mail_passwd),
                            subject=MAIL_SUBJECT)
        mh.setFormatter(LogMailFormatter())
        mh.setLevel(logging.ERROR)
        log.addHandler(mh)

    def setup_db(self):
        log.debug('connect database at {}:{}'
                  .format(options.dbhost, options.dbport))

        model = BaseBlogModel(host=options.dbhost, port=options.dbport)
        self.conn = model.conn
        self.db = model.db
        self.mongo_conn = model.mongo_conn
        self.mongo_db = model.mongo_db

        # ensure index
        # posts
        # posts_idx = pymongo.IndexModel([('post_name',)], unique=True)
        # self.mongo_db.posts.create_indexes([posts_idx])
        self.mongo_db.posts.ensure_index([('post_name', pymongo.ASCENDING)], unique=True)  # PyMongo2.8
        # users
        # account_idx = pymongo.IndexModel([('account',)], unique=True)
        # username_idx = pymongo.IndexModel([('username',)], unique=True)
        # self.mongo_db.users.create_indexes([account_idx, username_idx])
        self.mongo_db.users.ensure_index([('account', pymongo.ASCENDING)], unique=True)   # PyMongo2.8
        self.mongo_db.users.ensure_index([('username', pymongo.ASCENDING)], unique=True)  # PyMongo2.8
