import tornado.ioloop

from .keyword import bind_task as bind_keyword_task


def setup_tasks(ioloop=False):
    ioloop = ioloop or tornado.ioloop.IOLoop.instance()
    bind_keyword_task(ioloop)
