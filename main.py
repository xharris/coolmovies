from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pkg import client, model, env, auth, math2
from pymongo import MongoClient
from typing import List, Dict, Annotated, Optional
from pydantic import BaseModel
from os import environ
from logging import getLogger, basicConfig, INFO
from pydantic_mongo import PydanticObjectId
import os
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

DEFAULT_TAGS = ['scary', 'relaxing', 'trippy', 'confusing', 'funny']

basicConfig()
log = getLogger(__name__)
log.setLevel(INFO)

def get_real_ip(request: Request) -> str:
    return request.headers.get("x-forwarded-for", request.client.host).split(",")[0].strip()

limiter = Limiter(key_func=get_real_ip)
db_client = MongoClient(environ.get("MONGODB_URL"))
db = db_client.get_database(environ.get("MONGODB_NAME"))
DependsCurrentUser = auth.make_depends_user(db)

SYSTEM_USER_ID = PydanticObjectId("000000000000000000000000")

def migrate():
    media_repo = model.MediaRepo(db)
    # missing Media.stats
    medias: List[model.Media] = list(media_repo.find_by({"stats": {"$exists": False}}))
    media_repo.save_many(medias)
    # seed default tags
    tag_repo = model.TagRepo(db)
    tag_repo.ensure_indexes()
    for name in DEFAULT_TAGS:
        if not tag_repo.find_one_by({"name": name}):
            tag_repo.save(model.Tag(name=name, created_by=SYSTEM_USER_ID))

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not environ.get("PRODUCTION"):
        migrate()
    yield

app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_cors_env = environ.get("CORS_ORIGINS", "")
origins = (
    [o.strip() for o in _cors_env.split(",") if o.strip()]
    if _cors_env
    else ["http://localhost", "http://localhost:5173"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


def update_media_stats(media: model.Media):
    tag_repo = model.TagRepo(db)
    tag_vote_repo = model.TagVoteRepo(db)
    media_repo = model.MediaRepo(db)

    tag_votes = list(tag_vote_repo.find_by({
        "media": media.id,
    }))
    tags = tag_repo.all()
    media.stats.votes = {
        str(t.id): len([v for v in tag_votes if v.tag == t.id])
        for t in tags
    }
    return media_repo.save(media)

@app.get("/api/media/all")
def media_all():
    repo = model.MediaRepo(db)
    docs = repo.get_collection().aggregate([
        {"$addFields": {"votesArray": {"$objectToArray": "$stats.votes"}}},
        {"$match": {"votesArray.v": {"$gt": 0}}},
        {"$unset": "votesArray"},
    ])
    user_count = model.UserRepo(db).get_collection().count_documents({})
    medias = [model.Media(**{**doc, "id": doc["_id"]}) for doc in docs]
    return sorted(
        [{**m.model_dump(mode="json"), "rank": math2.compute_rank(m, user_count)} for m in medias],
        key=lambda m: m["rank"],
        reverse=True,
    )

class MediaSearchBody(BaseModel):
    query: str

@app.post("/api/media/search")
def media_search(body: MediaSearchBody):
    new_medias: List[model.Media] = []
    # search imdb
    imdb_client = client.FMDB()
    res = imdb_client.search_imdb(body.query)
    try:
        res.raise_for_status()
    except Exception as e:
        log.error("could not search fmdb: %s", e)
    data = res.json()
    if data["ok"]:
        for item in data["description"]:
            try:
                new = model.Media(
                    title=item.get("#TITLE"),
                    year=item.get("#YEAR"),
                    imdb_id=item.get("#IMDB_ID"),
                    imdb_url=item.get("#IMDB_URL"),
                    img=item.get("#IMG_POSTER"),
                )
                new_medias.append(new)
            except Exception as e:
                log.warning("could not parse fmdb item:\nitem=%s\n%s", item, e)
    # search thegamesdb
    games_client = client.TheGamesDB()
    res = games_client.games_by_game_name(body.query, ['platform'])
    try:
        res.raise_for_status()
    except Exception as e:
        log.error("could not search thegamesdb: %s", e)
    # store in db
    repo = model.MediaRepo(db)
    medias: List[model.Media] = []
    item: Dict
    for new in new_medias:
        if m := repo.find_one_by({"$or": [{"imdb_id": new.imdb_id}]}):
            log.info("save existing: %s (%d, %s)", m.title, m.year, m.imdb_id)
            medias.append(m)
        else:
            log.info("add media: %s (%d, %s)", new.title, new.year, new.imdb_id)
            repo.save(new)
            medias.append(new)
    return medias

@app.get("/api/tag/all")
def tag_all():
    return model.TagRepo(db).all()

@app.post("/api/tag/add/{name}")
def tag_add(name: str, current_user: Annotated[str,DependsCurrentUser]):
    # check user user role
    user_repo = model.UserRepo(db)
    user = user_repo.find_one_by_id(PydanticObjectId(current_user))
    if not user or not model.UserRole.admin in user.roles:
        log.info("invalid roles: %s", user.roles if user else None)
        raise HTTPException(401)
    name = name.lower()
    tag_repo = model.TagRepo(db)
    tag = tag_repo.find_one_by({"name": name})
    if not tag:
        log.info("create new tag")
        tag = model.Tag(name=name, created_by=PydanticObjectId(current_user))
        tag_repo.save(tag)
        return str(tag.id)
    return str(tag.id)

class TagEditBody(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    theme: Optional[str] = None

@app.post("/api/tag/{id}")
def tag_edit(id: str, body: TagEditBody):
    tag_repo = model.TagRepo(db)
    tag = tag_repo.find_one_by_id(id)
    if not tag:
        raise HTTPException(404, "tag not found")
    if body.name:
        tag.name = body.name
    if body.description:
        tag.description = body.description
    tag.theme = body.theme
    tag_repo.save(tag)
    

@app.get("/api/media/{media_id}/tagvotes")
def media_tag_votes(media_id: str, current_user: Annotated[str,DependsCurrentUser]):
    media_repo = model.MediaRepo(db)
    tag_vote_repo = model.TagVoteRepo(db)
    # get media
    media = media_repo.find_one_by_id(media_id)
    if not media:
        raise HTTPException(404, "media not found")
    return list(tag_vote_repo.find_by({
        'media': media.id,
        'created_by': PydanticObjectId(current_user),
    }))

@app.put("/api/media/{media_id}/addtag/{tag_id}")
@limiter.limit("10/minute")
def media_add_tag(request: Request, media_id: str, tag_id: str, current_user: Annotated[str,DependsCurrentUser]):
    media_repo = model.MediaRepo(db)
    tag_repo = model.TagRepo(db)
    tag_vote_repo = model.TagVoteRepo(db)
    # get media
    media = media_repo.find_one_by_id(media_id)
    if not media:
        raise HTTPException(404, "media not found")
    # get tag
    tag = tag_repo.find_one_by_id(tag_id)
    if not tag:
        raise HTTPException(404, "tag not found")
    # add vote
    tag_vote = tag_vote_repo.find_one_by({
        "media": PydanticObjectId(media_id),
        "tag": tag.id,
        "created_by": PydanticObjectId(current_user)
    })
    if not tag_vote:
        tag_vote = model.TagVote(
            tag=tag.id,
            media=PydanticObjectId(media_id),
            created_by=PydanticObjectId(current_user),
        )
    res = tag_vote_repo.save(tag_vote)
    update_media_stats(media)
    log.info("media add tag: %s", res)

@app.put("/api/media/{media_id}/removetag/{tag_id}")
@limiter.limit("10/minute")
def media_remove_tag(request: Request, media_id: str, tag_id: str, current_user: Annotated[str,DependsCurrentUser]):
    media_repo = model.MediaRepo(db)
    tag_repo = model.TagRepo(db)
    tag_vote_repo = model.TagVoteRepo(db)
    # get media
    media = media_repo.find_one_by_id(media_id)
    if not media:
        raise HTTPException(404, "media not found")
    # get tag
    tag = tag_repo.find_one_by_id(tag_id)
    if not tag:
        raise HTTPException(404, "tag not found")
    # remove tag vote
    res = tag_vote_repo.delete_vote(media.id, tag.id, created_by=PydanticObjectId(current_user))
    update_media_stats(media)
    log.info("media remove tag: %s", res)

@app.get("/api/user/count")
def user_count():
    user_repo = model.UserRepo(db)
    return user_repo.get_collection().count_documents({})

@app.get('/api/user/roles')
def user_roles(current_user: Annotated[str,DependsCurrentUser]):
    user_repo = model.UserRepo(db)
    user = user_repo.find_one_by_id(PydanticObjectId(current_user))
    if not user:
        log.error("user not found: id=%s", current_user)
        return []
    log.info('found user: %s', user)
    return user.roles

@app.get("/api/auth/check")
def auth_check(current_user: Annotated[str, DependsCurrentUser]):
    return str(current_user)

if __name__ == '__main__':
    pass

_dist_dir = os.path.join(os.path.dirname(__file__), "web", "dist")
if os.path.isdir(_dist_dir):
    app.mount("/", StaticFiles(directory=_dist_dir, html=True), name="static")
