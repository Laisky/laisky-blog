#!/usr/bin/env python
# -*- coding: utf-8 -*-
import datetime

from bson import ObjectId


def unquote_fr_mongo(docu):
    docu = docu.copy()
    for k, v in docu.items():
        if isinstance(v, datetime.date):
            docu[k] = v.timestamp() * 1000
        elif isinstance(v, ObjectId):
            docu[k] = str(v)

    return docu
