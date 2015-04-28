#!/usr/bin/env python
# -*- coding: utf-8 -*-
import re
import sys
import logging

from .encryt import generate_passwd, validate_passwd
from .jinja import debug_wrapper, TemplateRendering
from .mongo import unquote_fr_mongo
from ..const import LOG_NAME, LOG_PATH


log = logging.getLogger(LOG_NAME)
__all__ = ['generate_passwd', 'validate_passwd', 'validate_email',
           'validate_mobile',
           'debug_wrapper', 'setup_log', 'unquote_fr_mongo',
           'TemplateRendering']


def setup_log():
    _format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    formatter = logging.Formatter(_format)
    # set stdout
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.DEBUG)
    ch.setFormatter(formatter)
    # set log file
    fh = logging.FileHandler(LOG_PATH)
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(formatter)
    # log
    log = logging.getLogger(LOG_NAME)
    log.addHandler(ch)
    log.addHandler(fh)


def validate_email(email):
    epat = re.compile(r'^[_a-z0-9-]+(\.[_a-z0-9-]+)*'
                      r'@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,4})$')
    return epat.match(email)


def validate_mobile(mobile):
    ippat = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')
    return ippat.match(mobile)
