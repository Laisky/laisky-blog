# import motor
import pymongo
from bson import ObjectId


class classproperty(object):
    def __init__(self, f):
        self.f = f

    def __get__(self, obj, owner):
        return self.f(owner)


class BaseModel(object):
    _CONNECTION = None
    _MONGO_CONNECTION = None

    @classmethod
    def oid(cls, sid):
        return ObjectId(sid)

    @classmethod
    def make_connection(cls, host, port, db, username, passwd):
        mongo_url = f'mongodb://{username}:{passwd}@{host}:{port}/{db}'
        # cls._CONNECTION = motor.MotorClient(mongo_url)
        cls._MONGO_CONNECTION = pymongo.MongoClient(mongo_url)
        return cls

    @classproperty
    def db(cls):
        return cls.get_db()

    @classproperty
    def conn(cls):
        return cls.get_conn()

    @classproperty
    def mongo_conn(cls):
        return cls.get_mongo_conn()

    @classproperty
    def collection(cls):
        return cls.get_collection()

    @classproperty
    def mongo_db(cls):
        return cls.get_mongo_db()

    @classproperty
    def mongo_collection(cls):
        return cls.get_mongo_collection()

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
