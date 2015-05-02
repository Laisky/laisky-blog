import logging

import tornado

from .base import BaseHandler
from ..const import LOG_NAME
from ..utils import debug_wrapper


log = logging.getLogger(LOG_NAME)


class UserHandler(BaseHandler):

    def get(self, url):
        log.info('GET UserHandler {}'.format(url))

        router = {
            'login': self.login,
        }
        router.get(url, self.redirect_404)()

    @tornado.gen.coroutine
    @debug_wrapper
    def login(self):
        self.render2('login/index.html')
        self.finish()
