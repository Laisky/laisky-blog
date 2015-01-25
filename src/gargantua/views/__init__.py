#!/usr/bin/env python
# -*- coding: utf-8 -*-
from .base import BaseHandler

__all__ = ['BaseHandler']


class PageNotFound(BaseHandler):

    def get(self, url=''):
        self.render('404.html', url=url)
        self.finish()
