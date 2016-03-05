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

from gargantua.settings import CWD
from gargantua.utils import setup_log, generate_random_string, \
    get_default_config, logger
from gargantua.views import BaseHandler, PostsHandler, UserHandler
from gargantua.apis import PostApiHandler
from gargantua.libs import LogMailHandler, LogMailFormatter
from gargantua.models import BaseBlogModel


# settings
define('port', default=get_default_config('LISTEN_PORT'), type=int)
define('debug', default=get_default_config('DEBUG'), type=bool)
# database
define('dbname', default=get_default_config('DB_NAME'), type=str)
define('dbhost', default=get_default_config('DB_HOST'), type=str)
define('dbport', default=get_default_config('DB_PORT'), type=int)
# mail
define('mail_host', default=get_default_config('MAIL_HOST'), type=str)
define('mail_port', default=get_default_config('MAIL_PORT'), type=int)
define('mail_subject', default=get_default_config('MAIL_SUBJECT'), type=str)
define('mail_from_addr', default=get_default_config('MAIL_FROM_ADDR'), type=str)
define('mail_to_addrs', default=get_default_config('MAIL_TO_ADDRS'), type=str)
define('mail_username', default=get_default_config('MAIL_USERNAME'), type=str)
define('mail_passwd', default=get_default_config('MAIL_PASSWD'), type=str)

setup_log(options.debug)


class PageNotFound(BaseHandler):

    @tornado.gen.coroutine
    def get(self, url=None):
        logger.debug('GET PageNotFound for url {}'.format(url))

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
            url(r'^/(amend)/$', PostsHandler, name='post:amend'),
            url(r'^/(login)/$', UserHandler, name='user:login'),
            url(r'^/(search)/$', PostsHandler, name='post:search'),
            url(r'^/(profile)/$', UserHandler, name='user:profile'),
            # ---------------- rss ----------------
            url(r'^/(rss)/$', PostsHandler, name='post:rss'),
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
        # if not options.debug:
        self.setup_mail_handler()

        super(Application, self).__init__(handlers, **settings)

    def setup_mail_handler(self):
        # set mail handler
        mh = LogMailHandler(mailhost=(options.mail_host, options.mail_port),
                            fromaddr=options.mail_from_addr,
                            toaddrs=options.mail_to_addrs,
                            credentials=(options.mail_username, options.mail_passwd),
                            subject=options.mail_subject)
        mh.setFormatter(LogMailFormatter())
        mh.setLevel(logging.ERROR)
        logging.getLogger().addHandler(mh)

    def setup_db(self):
        logger.debug('connect database at {}:{}'
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
