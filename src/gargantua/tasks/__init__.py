from concurrent.futures import ThreadPoolExecutor

import tornado.ioloop

from .keyword import bind_task as bind_keyword_task


executor = ThreadPoolExecutor(max_workers=2)


def setup_tasks(ioloop=False):
    ioloop = ioloop or tornado.ioloop.IOLoop.instance()
    bind_keyword_task(ioloop, executor)
