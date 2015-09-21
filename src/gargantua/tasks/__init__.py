from concurrent.futures import ThreadPoolExecutor

import tornado.ioloop
from tornado.platform.asyncio import to_tornado_future

from .keyword import bind_task as bind_keyword_task


executor = ThreadPoolExecutor(max_workers=2)


def setup_tasks(ioloop=False):
    ioloop = ioloop or tornado.ioloop.IOLoop.instance()
    bind_keyword_task(ioloop, executor)


def delay_task(func, callback=None, *args, **kw):
    asynfutu = executor.submit(func, *args, **kw)
    if callback:
        tonafutu = to_tornado_future(asynfutu)
        ioloop = tornado.ioloop.IOLoop.current()
        ioloop.add_future(tonafutu, callback)
