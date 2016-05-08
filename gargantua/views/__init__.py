import tornado

from .base import BaseHandler
from .archives import PostsHandler
from .user import UserHandler


__all__ = [
    'BaseHandler', 'PostsHandler',
    'UserHandler',
    'ReactRender',
]


class ReactRender(BaseHandler):

    @tornado.gen.coroutine
    def get(self):
        return self.render2('base.html')
