from os import getenv

def mustgetenv(key: str):
    value = getenv(key)
    if not value:
        raise Exception("missing env var %s" % (key))
    return value