from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pkg import model, fmdb, env, auth
from pymongo import MongoClient
from typing import List, Dict, Annotated
from pydantic import BaseModel
from os import environ
from logging import getLogger, basicConfig, INFO
from pydantic_mongo import PydanticObjectId

basicConfig()
log = getLogger(__name__)
log.setLevel(INFO)

app = FastAPI()
origins = [
    "http://localhost",
    "http://localhost:5173"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

client = MongoClient(environ.get("MONGODB_URL"))
db = client.get_database(environ.get("MONGODB_NAME"))
DependsCurrentUser = auth.make_depends_user(db)

def migrate():
    media_repo = model.MediaRepo(db)
    # missing Media.stats
    medias: List[model.Media] = list(media_repo.find_by({"stats": {"$exists": False}}))
    media_repo.save_many(medias)

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
    return [model.Media(**{**doc, "id": doc["_id"]}) for doc in docs]

class MediaSearchBody(BaseModel):
    query: str

@app.post("/api/media/search")
def media_search(body: MediaSearchBody):
    client = fmdb.FMDB()
    res = client.search_imdb(body.query)
    res.raise_for_status()
    data = res.json()
    if not data["ok"]:
        pass
    # store in db
    repo = model.MediaRepo(db)
    medias: List[model.Media] = []
    item: Dict
    for item in data["description"]:
        try:
            media = model.Media(
                title=item.get("#TITLE"),
                year=item.get("#YEAR"),
                imdb_id=item.get("#IMDB_ID"),
                imdb_url=item.get("#IMDB_URL"),
                img=item.get("#IMG_POSTER"),
            )
            if m := repo.find_one_by({"imdb_id": media.imdb_id}):
                log.info("save existing: %s", m)
                medias.append(m)
            else:
                log.info("add media: %s", media)
                repo.save(media)
                medias.append(media)
        except Exception as e:
            log.warning("could not parse fmdb item:\nitem=%s\n%s", item, e)
    return medias

@app.get("/api/tag/all")
def tag_all():
    return model.TagRepo(db).all()

@app.post("/api/tag/add/{name}")
def tag_add(name: str, current_user: Annotated[str,DependsCurrentUser]):
    name = name.lower()
    tag_repo = model.TagRepo(db)
    tag = tag_repo.find_one_by({"name": name})
    if not tag:
        log.info("create new tag")
        tag = model.Tag(name=name, created_by=current_user)
        tag_repo.save(tag)
        return str(tag.id)
    return str(tag.id)

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
def media_add_tag(media_id: str, tag_id: str, current_user: Annotated[str,DependsCurrentUser]):
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
def media_remove_tag(media_id: str, tag_id: str, current_user: Annotated[str,DependsCurrentUser]):
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
    return user_repo.get_collection().count_documents()

@app.get("/api/auth/check")
def auth_check(user_id: Annotated[str, DependsCurrentUser]):
    return str(user_id)

migrate()

if __name__ == '__main__':
    # get_media_search(MediaSearchBody(query="person of"))
    pass