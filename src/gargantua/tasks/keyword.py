"""
统一对外暴露 bind_task(ioloop) 作为借口
"""

import re
import logging
import heapq
from operator import itemgetter
from collections import defaultdict

from tornado.options import options
import pymongo
import jieba.analyse

from ..const import LOG_NAME
from ..utils import utcnow


log = logging.getLogger(LOG_NAME)
N_CHINESE_KEYWORDS = 30
N_ENGLISH_KEYWORDS = 20


def bind_task(ioloop):
    def callback(*args, **kw):
        when = ioloop.time() + 60 * 60
        log.debug('add new task load_keywords at {}'.format(when))
        log.info('Run task load_keywords')
        load_keywords(*args, **kw)
        ioloop.call_at(when, callback, *args, **kw)

    when = ioloop.time() + 10
    ioloop.call_at(when, callback, dbhost=options.dbhost, dbport=options.dbport)


def load_keywords(dbhost='localhost', dbport=27017):
    log.debug('load_keywords for dbhost {}, dbport {}'.format(dbhost, dbport))

    conn = pymongo.MongoClient(dbhost, dbport)
    db = conn.blog

    contents = []
    for docu in db.posts.find({'post_password': ''}, {'post_content'}):
        contents.append(docu['post_content'])

    c = '\t'.join(contents)
    k_cn = load_chinese_keyword(c)
    log.debug('load chinese keywords: {}'.format(k_cn))
    k_en = load_english_keyword(c)
    log.debug('load english keywords: {}'.format(k_en))
    keywords = [] + k_cn + k_en

    db.statistics.update(
        {'types': 'keyword'},
        {'$set': {
            'types': 'keyword',
            'keywords': keywords,
            'modified_at_gmt': utcnow()
        }}, upsert=True
    )


def load_chinese_keyword(content):
    return jieba.analyse.extract_tags(content, topK=N_CHINESE_KEYWORDS, allowPOS=('ns'))


def load_english_keyword(content):
    eng_kw_regex = re.compile('[a-zA-Z]{5,10}')
    ignores = set([
        'strong', 'class', 'style', 'uploads', 'align', 'height', 'image',
        'center', 'aligncenter', 'target', 'blockquote', 'blank', 'response',
        'width', 'align', 'alignleft', 'attachment', 'password', 'login',
        'valign', 'content', 'value', 'print', 'import', 'datetime', 'title', 'padding',
        'laisky', 'return', 'images', 'start', 'about', 'cinderellananako',
        'pnumber', 'subject', 'alignnone', 'ppcelery', 'color', 'config', 'shell',
        'static', 'index', 'label', 'number', 'param', 'users', 'first', 'notebook',
        'write', 'volume', 'files', 'total', 'timeit', 'latest', 'which', 'login',
        'field', 'requesthandler',
    ])
    key_map = defaultdict(int)
    kws = jieba.cut(content, cut_all=False)
    for k in kws:
        k = k.strip().lower()
        if k in ignores or not eng_kw_regex.match(k):
            continue

        key_map[k] += 1

    return [
        ks[0] for ks in
        heapq.nlargest(N_ENGLISH_KEYWORDS, key_map.items(), key=itemgetter(1))
    ]


if __name__ == '__main__':
    load_keywords()
