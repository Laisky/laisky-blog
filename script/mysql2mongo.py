#!/usr/bin/env python
# -*- coding: utf-8 -*-
import pymongo
import pymysql


host = '127.0.0.1'
# mysql
mysql_conn = pymysql.connect(host, user='root', passwd='pineapple',
                             db='wordpress', charset='utf8')
cursor = mysql_conn.cursor()
cursor.execute('SELECT * FROM wp_posts')

# mongo
conn = pymongo.MongoClient(safe=True)
db = pymongo['blog']


headers = (
    "id", "post_author", "post_date", "post_date_gmt", "post_content",
    "post_title", "post_excerpt", "post_status", "comment_status",
    "ping_status", "post_password", "post_name", "to_ping", "pinged",
    "post_modified", "post_modified_gmt", "post_content_filtered",
    "post_parent", "guid", "menu_order", "post_type", "post_mime_type",
    "comment_count"
)


for content in cursor:
    docu = dict(zip(headers, content))
    db['post'].update(
        {'id': docu['id']},
        {'$set': docu},
        upsert=True
    )
