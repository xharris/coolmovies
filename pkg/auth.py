from fastapi import Depends, Request, Response
from logging import getLogger
from jwt import encode, decode
from pydantic import BaseModel
from pydantic_mongo import PydanticObjectId
from pymongo.database import Database
from . import env, model

log = getLogger(__name__)

SESSION_TOKEN_COOKIE = "session_token"
ALGORITHM = "HS256"

class SessionToken(BaseModel):
    id: PydanticObjectId

def make_depends_user(db: Database):
    def _get_current_user_id(req: Request, resp: Response):
        SECRET_KEY = env.mustgetenv('SECRET_KEY')
        session_token = req.cookies.get(SESSION_TOKEN_COOKIE)

        if not session_token:
            log.info("create session token")
            # create user
            user = model.User()
            model.UserRepo(db).save(user)
            # create session token data
            token = SessionToken(id=user.id)
            encoded = encode(token.model_dump(mode="json"), SECRET_KEY, algorithm=ALGORITHM)
            resp.set_cookie(SESSION_TOKEN_COOKIE, encoded, httponly=True, samesite="lax")
            return user.id
        
        # decode token
        payload = decode(session_token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["id"]

    return Depends(_get_current_user_id)

