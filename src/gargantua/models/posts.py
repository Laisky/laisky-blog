#!/usr/bin/env python
# -*- coding: utf-8 -*-

from .users import Users
from motorengine import Document, StringField, DateTimeField, ReferenceField


class Posts(Document):
    meta = {'collection': 'posts'}

    comment_status = StringField(required=True, default='open')
    post_author = ReferenceField(reference_document_type=Users, required=True)
    post_content = StringField(required=True)
    post_modified_gmt = DateTimeField()
    post_name = StringField(required=True, unique=True)
    post_password = StringField()
    post_status = StringField(required=True, default='publish')
    post_title = StringField(required=True)
