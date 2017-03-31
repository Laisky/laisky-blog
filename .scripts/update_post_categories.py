import pymongo
from bson import ObjectId


conn = pymongo.MongoClient('localhost', 27016)
db = conn['blog']
col = db['categories']
categories = [
    '技术笔记',
    '杂文',
    '观后感',
    '游记',
    '科学',
]


def main():
    for cate in categories:
        col.update_one({
            'name': cate,
            'author': ObjectId('25b3edc00000000000008888'),
            'parent': None,
        })
