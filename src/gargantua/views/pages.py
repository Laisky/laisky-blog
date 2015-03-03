#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging

from ..const import LOG_NAME
from ..utils import BaseHandler


log = logging.getLogger(LOG_NAME)


class ArticlesPage(BaseHandler):

    def get(self):
        log.info('ArticlesPage GET')

        self.render('articles.html')


class MainPage(BaseHandler):
    pass


class AboutMe(BaseHandler):
    pass


class PostPage(BaseHandler):
    pass
