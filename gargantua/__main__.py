#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging

import tornado.httpserver
import tornado.options as opt
from tornado.options import options

from gargantua.app import Application
from gargantua.tasks import setup_tasks
from gargantua.utils import logger


def main():
    opt.parse_command_line()

    http_server = tornado.httpserver.HTTPServer(Application(), xheaders=True)
    http_server.listen(options.port)

    if options.debug:
        logger.info('start application in debug mode')
        logger.setLevel(logging.DEBUG)
    else:
        logger.info('start application in normal mode')
    ioloop = tornado.ioloop.IOLoop.instance()

    if not options.debug:
        setup_tasks(ioloop)

    ioloop.start()

if __name__ == '__main__':
    main()
