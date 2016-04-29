#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import re
import sys
import random
import datetime
import string
import logging

import pytz

from gargantua.settings import LOG_NAME, LOG_PATH
from gargantua import settings
from .encryt import generate_passwd, validate_passwd, \
    generate_token, validate_token
from .jinja import TemplateRendering
from .tornado import debug_wrapper, \
    DbHandlerMixin, WebHandlerMixin, AuthHandlerMixin, HttpErrorMixin, \
    JinjaMixin, RFCMixin
from .mongo import unquote_fr_mongo
from .markdown import render_md_to_html


logger = logging.getLogger(LOG_NAME)
__all__ = [
    'generate_passwd', 'validate_passwd', 'validate_email',
    'validate_mobile', 'generate_token', 'validate_token',
    'debug_wrapper', 'setup_log', 'unquote_fr_mongo',
    'TemplateRendering', 'render_md_to_html',
    'DbHandlerMixin', 'WebHandlerMixin', 'AuthHandlerMixin',
    'HttpErrorMixin', 'JinjaMixin', 'RFCMixin',
    'utc2cst_timestamp', 'utcnow', 'utc2cst', 'dt2timestamp',
    'UTC', 'CST'
]

tz = pytz.timezone('utc')
UTC = tz
CST = pytz.timezone('Asia/Shanghai')
oid_regex = re.compile(r'[a-z0-9]{24}')


def is_objectid(s):
    return oid_regex.fullmatch(s)


def get_default_config(varname):
    return os.environ.get(varname, getattr(settings, varname, ''))


def utcnow():
    return datetime.datetime.utcnow().replace(tzinfo=tz)


def utc2cst(dt):
    return dt + datetime.timedelta(hours=8)


def dt2timestamp(dt):
    return dt.timestamp()


def utc2cst_timestamp(dt):
    return dt2timestamp(utc2cst(dt))


def setup_log(debug=False):
    log_level = logging.DEBUG if debug else logging.INFO
    _format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    formatter = logging.Formatter(_format)
    # set stdout
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.DEBUG)
    ch.setFormatter(formatter)
    # set log file
    # fh = logging.FileHandler(LOG_PATH)
    # fh.setLevel(log_level)
    # fh.setFormatter(formatter)
    # log
    logging.getLogger(LOG_NAME).setLevel(logging.DEBUG)
    log = logging.getLogger()
    log.setLevel(log_level)
    log.addHandler(ch)
    # log.addHandler(fh)


def validate_email(email):
    epat = re.compile(r'^[_a-z0-9-]+(\.[_a-z0-9-]+)*'
                      r'@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,4})$')
    return epat.match(email)


def validate_mobile(mobile):
    ippat = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')
    return ippat.match(mobile)


def generate_random_string(length):
    alphbet = string.ascii_letters + ''.join([str(i) for i in range(10)])
    return ''.join([random.choice(alphbet) for i in range(length)])


def singleton(cls, *args, **kw):
    instances = {}

    def _singleton():
        if cls not in instances:
            instances[cls] = cls(*args, **kw)
        return instances[cls]
    return _singleton
