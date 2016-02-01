import tornado

from .base import BaseBlogModel


class UsersModel(BaseBlogModel):

    __collection__ = 'users'


class ArticleAuthorsModel(UsersModel):
    pass
