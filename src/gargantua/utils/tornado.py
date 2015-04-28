#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import json
import logging
import traceback
import datetime
from math import ceil

import tornado.web
from jinja2 import Environment, FileSystemLoader
from webassets import Environment as AssetsEnvironment
from webassets.ext.jinja2 import AssetsExtension

from ..const import OK, LOG_NAME, N_POST_PER_PAGE


log = logging.getLogger(LOG_NAME)
__all__ = ['debug_wrapper',
           'BaseHandler']


def debug_wrapper(func):
    def wrapper(*args, **kw):
        try:
            yield from func(*args, **kw)
        except Exception:
            log.error(traceback.format_exc())
            raise
    return wrapper


class TemplateRendering():
    """
    A simple class to hold methods for rendering templates.
    Copied from
        http://bibhas.in/blog/\
            using-jinja2-as-the-template-engine-for-tornado-web-framework/
    """
    _jinja_env = None
    _assets_env = None

    def render_template(self, template_name, **kw):
        if not self._jinja_env:
            self._jinja_env = Environment(
                loader=FileSystemLoader(self.settings['template_path']),
                extensions=[AssetsExtension]
            )
            self._jinja_env.filters['UTC2CST'] = \
                lambda dt: dt + datetime.timedelta(seconds=28800)

        if not self._assets_env:
            self._assets_env = AssetsEnvironment(
                self.settings['static_path'],
                self.settings['static_url_prefix'],
            )
            self._jinja_env.assets_environment = self._assets_env

        template = self._jinja_env.get_template(template_name)
        content = template.render(kw)
        return content


class BaseHandler(tornado.web.RequestHandler, TemplateRendering):

    def get(self, url=None):
        url = url.strip(' /')
        super().get(url)

    @property
    def db(self):
        return self.application.db

    @property
    def ip(self):
        return self.request.headers.get('X-Real-IP', self.request.remote_ip)

    def write_json(self, *, status=OK, msg='', data={}):
        self.write(json.dumps({
            'status': status,
            'msg': msg,
            'data': data
        }))

    @property
    def is_ajax(self):
        return self.request.headers.get('X-Requested-With') == "XMLHttpRequest"

    @property
    def is_https(self):
        return self.request.headers.get('X-Scheme') == "https"

    def redirect_404(self):
        self.redirect('/404.html')

    def render2(self, template_name, **kwargs):
        """
        This is for making some extra context variables available to
        the template
        """
        def static_url(path):
            prefix = self.settings.get('static_url_prefix')
            return os.path.join(prefix, path)

        kwargs.update({
            'settings': self.settings,
            'static_url': static_url,
            'request': self.request,
            'xsrf_token': self.xsrf_token,
            'xsrf_form_html': self.xsrf_form_html,
            'max': max,
            'min': min,
            'is_ajax': self.is_ajax,
            'is_https': self.is_https,
        })
        content = self.render_template(template_name, **kwargs)
        self.write(content)

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
