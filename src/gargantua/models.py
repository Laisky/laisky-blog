class BaseModel():
    DB = None

    @classmethod
    def set_db(cls, db):
        cls.DB = db


class Tweets(BaseModel):

    @classmethod
    def load_tweets(cls, query=None, count=None, sort=None):


