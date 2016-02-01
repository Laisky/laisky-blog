import motor
import pymongo


class BaseModel:
    _CONNECTION = None  # motor connection
    _MONGO_CONNECTION = None  # pymongo connection

    def __init__(self, host, port):
        self.make_connection(host, port)

    @classmethod
    def make_connection(cls, host, port):
        cls._CONNECTION = motor.MotorClient(host=host, port=port)
        cls._MONGO_CONNECTION = pymongo.MongoClient(host=host, port=port)

    @property
    def db(self):
        return self.get_db()

    @property
    def conn(self):
        return self.get_conn()

    @property
    def mongo_conn(self):
        return self.get_mongo_conn()

    @property
    def collection(self):
        return self.get_collection()

    @property
    def mongo_db(self):
        return self.get_mongo_db()

    @property
    def mongo_collection(self):
        return self.get_mongo_collection()

    @classmethod
    def get_conn(cls):
        assert getattr(cls, '_CONNECTION'), '_CONNECTION not defined!'
        return cls._CONNECTION

    @classmethod
    def get_mongo_conn(cls):
        assert getattr(cls, '_MONGO_CONNECTION'), '_MONGO_CONNECTION not defined!'
        return cls._MONGO_CONNECTION

    @classmethod
    def get_db(cls):
        assert hasattr(cls, '__db__'), '__db__ not defined!'
        return cls._CONNECTION[cls.__db__]

    @classmethod
    def get_collection(cls):
        assert hasattr(cls, '__collection__'), '__collection__ not defined!'
        return cls.get_db()[cls.__collection__]

    @classmethod
    def get_mongo_db(cls):
        assert hasattr(cls, '__db__'), '__db__ not defined!'
        return cls._MONGO_CONNECTION[cls.__db__]

    @classmethod
    def get_mongo_collection(cls):
        assert hasattr(cls, '__collection__'), '__collection__ not defined!'
        return cls.get_db()[cls.__collection__]

    @classmethod
    def filter(cls, query):
        return cls.get_collection().find(query)

    @classmethod
    def get(cls, query):
        return cls.get_collection().find_one(query)


class BaseBlogModel(BaseModel):

    __db__ = 'blog'
