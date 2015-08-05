#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import logging
from math import ceil

import tornado
from raven.contrib.tornado import SentryMixin

from gargantua.const import LOG_NAME, N_POST_PER_PAGE
from gargantua.utils import TemplateRendering, \
    DbHandlerMixin, WebHandlerMixin, AuthHandlerMixin


log = logging.getLogger(LOG_NAME)
__all__ = ['BaseHandler']


class BaseHandler(tornado.web.RequestHandler,
                  TemplateRendering,
                  SentryMixin,
                  DbHandlerMixin,
                  WebHandlerMixin,
                  AuthHandlerMixin,):

    def get(self, url=None):
        url = url.strip(' /')
        super().get(url)

    def render2(self, template_name, **kwargs):
        """
        This is for making some extra context variables available to
        the template
        """
        content = self.render_template(template_name, **kwargs)
        self.write(content)

    def render_template(self, template_name, **kwargs):
        def static_url(path):
            prefix = self.settings.get('static_url_prefix')
            return os.path.join(prefix, path)

        _kwargs = ({
            'settings': self.settings,
            'static_url': static_url,
            'reverse_url': self.reverse_url,
            'request': self.request,
            'xsrf_token': self.xsrf_token,
            'xsrf_form_html': self.xsrf_form_html,
            'max': max,
            'min': min,
            'is_ajax': self.is_ajax,
            'is_https': self.is_https,
            'current_user': self.current_user,
            'current_app': 'blog',
        })
        _kwargs.update(kwargs)
        return super().render_template(template_name, **_kwargs)

    @tornado.gen.coroutine
    def prepare(self):
        super().prepare()
        cursor = self.db.posts.find()
        self.post_count = yield cursor.count()
        self.max_page = ceil(self.post_count / N_POST_PER_PAGE)
        log.debug('prepare for post_count {}, max_page {}'
                  .format(self.post_count, self.max_page))

    def render_post(self, template_name, **kwargs):
        kwargs.update({
            'max_page': self.max_page,
        })
        self.render2(template_name, **kwargs)
