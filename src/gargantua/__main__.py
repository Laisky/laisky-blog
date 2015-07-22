#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging

import tornado.httpserver
import tornado.options as opt
from tornado.options import options

from .app import Application
from .const import LOG_NAME
from .tasks import setup_tasks


log = logging.getLogger(LOG_NAME)


def main():
    opt.parse_command_line()

    http_server = tornado.httpserver.HTTPServer(Application())
    http_server.listen(options.port)

    if options.debug:
        log.info('start application in debug mode')
        log.setLevel(logging.DEBUG)
    else:
        log.info('start application in normal mode')
    ioloop = tornado.ioloop.IOLoop.instance()
    setup_tasks(ioloop)
    ioloop.start()

if __name__ == '__main__':
    main()
