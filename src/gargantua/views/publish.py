#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging

import tornado

from .base import BaseHandler
from ..const import LOG_NAME


log = logging.getLogger(LOG_NAME)


class PublishHandler(BaseHandler):
    """APIs about posts"""

    @tornado.web.authenticated
    def get(self):
        log.info('GET PublishHandler')

        self.render2('publish/index.html')
        self.finish()
