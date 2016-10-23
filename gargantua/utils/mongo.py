#!/usr/bin/env python
# -*- coding: utf-8 -*-
# import datetime
from numbers import Number

from bson import ObjectId


def unquote_fr_mongo(docu):
    docu = docu.copy()
    for k, v in docu.items():
        if isinstance(v, ObjectId):
            docu[k] = str(v)

    return docu


class MongoParser:

    def _parse_mongo_item(self, i):
        if not isinstance(i, Number):
            return str(i)

    def _parse_mongo_list(self, l):
        ret = []
        for i in l:
            if isinstance(i, list):
                ret.extend(self._parse_mongo_list(l))
            else:
                ret.append(self._parse_mongo_item(i))

        return ret

    def _parse_mongo_dict(self, d):
        ret = {}
        for k, v in d.items():
            k = self._parse_mongo_item(k)
            if isinstance(v, dict):
                v = self._parse_mongo_dict(v)
            elif isinstance(v, list):
                v = self._parse_mongo_list(v)
            else:
                v = self._parse_mongo_item(v)

            ret.update({k: v})

        return ret

    def parse(self, o):
        if isinstance(o, list):
            ret = []
            for so in o:
                ret.append(self.parse(so))

            return ret
        else:
            return self._parse_mongo_dict(o)
