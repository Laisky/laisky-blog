try:
    from .settings import *
except ImportError:
    from .settings_demo import *  # for test
