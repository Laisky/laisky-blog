#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging
import traceback


log = logging.getLogger(__name__)


def debug_wrapper(log=log):
    def wrapper(func):
        def _wrapper(*args, **kw):
            try:
                yield from func(*args, **kw)
            except Exception:
                log.error(traceback.format_exc())
                raise
        return _wrapper
    return wrapper
