import traceback
from concurrent.futures import ThreadPoolExecutor

import tornado.ioloop
from tornado.platform.asyncio import to_tornado_future

from gargantua.utils import logger


executor = ThreadPoolExecutor(max_workers=2)


def setup_tasks(ioloop=False):
    ioloop = ioloop or tornado.ioloop.IOLoop.instance()
    # bind_keyword_task(ioloop, executor)


def generate_default_callback(caller):
    def default_callback(future):
        try:
            result = future.result()
        except Exception:
            result = traceback.format_exc()

        logger.info('{caller} get result: {result}'
                    .format(caller=str(caller), result=result))

    return default_callback


def delay_task(func, *, callback=None, **kw):
    logger.info('delay_task for func {}'.format(str(func)))

    asynfutu = executor.submit(func, **kw)
    tonafutu = to_tornado_future(asynfutu)
    ioloop = tornado.ioloop.IOLoop.current()
    callback = callback or generate_default_callback(func)

    ioloop.add_future(tonafutu, callback)
