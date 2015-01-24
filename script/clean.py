#!/usr/bin/env python
# -*- coding: utf-8 -*-
import pymongo
import bson


conn = pymongo.MongoClient(safe=True)
db = conn['blog']
post = db['post']
posts = db['posts']

headers = (
    "id", "post_author", "post_date", "post_date_gmt", "post_content",
    "post_title", "post_excerpt", "post_status", "comment_status",
    "ping_status", "post_password", "post_name", "to_ping", "pinged",
    "post_modified", "post_modified_gmt", "post_content_filtered",
    "post_parent", "guid", "menu_order", "post_type", "post_mime_type",
    "comment_count"
)


for docu in post.find():
    if docu['post_status'] != 'publish':
        continue

    post_date = docu.pop('post_date_gmt')
    docu['_id'] = bson.ObjectId.from_datetime(post_date)
    docu['post_content'].replace('http://laisky.us/blog/wp-content',
                                 'http://blog.laisky.us')
    docu['post_content'].replace('http://blog.laisky.us/wp-content',
                                 'http://blog.laisky.us')
    del docu['id']
    del docu['post_date']
    del docu['post_excerpt']
    del docu['ping_status']
    del docu['to_ping']
    del docu['pinged']
    del docu['post_modified']
    del docu['post_content_filtered']
    del docu['post_parent']
    del docu['guid']
    del docu['menu_order']
    del docu['post_type']
    del docu['post_mime_type']
    del docu['comment_count']

    posts.insert(docu)
