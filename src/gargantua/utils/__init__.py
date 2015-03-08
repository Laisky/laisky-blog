#!/usr/bin/env python
# -*- coding: utf-8 -*-
import re
import sys
import logging

from .encryt import generate_passwd, validate_passwd
from .tornado import debug_wrapper, BaseHandler
from .mongo import unquote_fr_mongo


__all__ = ['generate_passwd', 'validate_passwd', 'debug_wrapper', 'setup_log',
           'validate_email', 'validate_mobile', 'BaseHandler',
           'unquote_fr_mongo']


def setup_log(log_name, log_dir):
    _format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    log = logging.getLogger(log_name)
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.DEBUG)
    formatter = logging.Formatter(_format)
    ch.setFormatter(formatter)
    log.addHandler(ch)


def validate_email(email):
    epat = re.compile(r'^[_a-z0-9-]+(\.[_a-z0-9-]+)*'
                      r'@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,4})$')
    return epat.match(email)


def validate_mobile(mobile):
    ippat = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')
    return ippat.match(mobile)
