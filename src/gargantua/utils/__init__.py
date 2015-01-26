#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import re
import sys
import logging


def setup_log(log_name, log_dir):
    _format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    logging.basicConfig(
        filename=os.path.join(log_dir, '{}.log'.format(log_name)),
        level=logging.DEBUG,
        format=_format
    )
    log = logging.getLogger()
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.INFO)
    formatter = logging.Formatter(_format)
    ch.setFormatter(formatter)
    log.addHandler(ch)


def validate_email(email):
    epat = re.compile(
        r'^[_a-z0-9-]+(\.[_a-z0-9-]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,4})$'
    )
    return epat.match(email)


def validate_mobile(mobile):
    ippat = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')
    return ippat.match(mobile)
