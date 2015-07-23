from concurrent.futures import ProcessPoolExecutor

import tornado.ioloop

from .keyword import bind_task as bind_keyword_task


executor = ProcessPoolExecutor(max_workers=2)


def setup_tasks(ioloop=False):
    ioloop = ioloop or tornado.ioloop.IOLoop.instance()
    bind_keyword_task(ioloop, executor)
