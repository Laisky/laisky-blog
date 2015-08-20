#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging
import traceback
import datetime
import json

from jinja2 import Environment, FileSystemLoader
from webassets import Environment as AssetsEnvironment
from webassets.ext.jinja2 import AssetsExtension

from ..const import LOG_NAME


log = logging.getLogger(LOG_NAME)
__all__ = ['debug_wrapper', 'TemplateRendering']


def debug_wrapper(func):
    def wrapper(*args, **kw):
        log.debug('debug_wrapper for args {}, kw {}'.format(args, kw))
        try:
            yield from func(*args, **kw)
        except Exception:
            self = args[0]
            err_msg = {
                'msg': traceback.format_exc(),
                'uri': self.request.uri,
                'version': self.request.version,
                'headers': self.request.headers,
                'cookies': self.request.cookies
            }
            log.error(json.dumps(err_msg, indent=4, sort_keys=True))
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
            self._jinja_env.filters.update({
                'utc2cst': lambda dt: dt + datetime.timedelta(hours=8),
                'jstime2py': lambda ts: datetime.datetime.fromtimestamp(ts / 1000),
                'time_format': lambda dt: datetime.datetime.strftime(dt, '%Y/%m/%d %H:%M:%S'),
            })

        if not self._assets_env:
            self._assets_env = AssetsEnvironment(
                self.settings['static_path'],
                self.settings['static_url_prefix'],
            )
            self._jinja_env.assets_environment = self._assets_env

        template = self._jinja_env.get_template(template_name)
        content = template.render(kw)
        return content
