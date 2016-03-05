#!/usr/bin/env python
# -*- coding: utf-8 -*-
import pathlib


# server
LISTEN_PORT = 27850

# common
CWD = pathlib.PurePath(__file__).parents[0]
LOG_NAME = 'gargantua'
LOG_PATH = '/tmp/gargantua-blog.log'
suffix = 0

# web signal
OK = 0
ERROR = 1

# db
DB_HOST = 'localhost'
DB_PORT = 27016
DB_NAME = 'blog'

# search
ES_HOST = 'localhost'
ES_PORT = 17200

# posts
N_POST_PER_PAGE = 10

# sentry
SENTRY_HOST = 'localhost'
SENTRY_PORT = 9000
SENTRY_NAME = '2'

# mail
MAIL_HOST = 'smtp.mailgun.org'
MAIL_PORT = 25
MAIL_SUBJECT = 'Gargantua Error'
FROM_ADDR = 'gargantua@laisky.com'
TO_ADDRS = ('ppcelery@gmail.com',)
MAIL_USERNAME = 'postmaster@mg.laisky.com'
MAIL_PASSWD = '123456'
