#!/usr/bin/env python
# -*- coding: utf-8 -*-
import pathlib


# server
SECRET_KEY = '34hj32k4hj3k4k3h539c905n8c90UMIFN#*N'
DEBUG = False
PORT = 27850

# common
CWD = pathlib.PurePath(__file__).parents[1]
LOG_NAME = 'gargantua'
LOG_PATH = '/tmp/gargantua-blog.log'
suffix = 0

# web signal
OK = 0
ERROR = 1

# db
DBHOST = 'localhost'
DBPORT = 27016
DBNAME = 'blog'

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
MAIL_FROM_ADDR = 'gargantua@laisky.com'
MAIL_TO_ADDRS = 'ppcelery@gmail.com'
MAIL_USERNAME = '<YOUR_SMTP_USERNAME>'
MAIL_PASSWD = '<YOUR_SMTP_PASSWORD>'
