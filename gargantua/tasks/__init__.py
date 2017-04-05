import traceback
import asyncio
from concurrent.futures import ThreadPoolExecutor

from gargantua.utils import logger


executor = ThreadPoolExecutor(max_workers=2)
ioloop = asyncio.get_event_loop()


def setup_tasks(ioloop=False):
    ioloop = ioloop or asyncio.get_event_loop()


async def delay_task(func, *args, **kw):
    logger.info('delay_task for func {}'.format(str(func)))

    return (await executor.submit(func, **kw))
