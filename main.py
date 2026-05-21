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
            if (m := repo.find_one_by({"imdb_id": media.imdb_id})) and m:
                log.info("save existing: %s", m)
                medias.append(m)
            else:
                log.info("add media: %s", media)
                medias.append(media)
        except Exception as e:
            log.warning("could not parse fmdb item:\nitem=%s\n%s", item, e)
    repo.save_many(medias)
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

@app.put("/api/media/{media_id}/addtag/{tag_id}")
def media_add_tag(media_id: str, tag_id: str, current_user: Annotated[str,DependsCurrentUser]):
    media_repo = model.MediaRepo(db)
    tag_repo = model.TagRepo(db)
    tag_vote_repo = model.TagVoteRepo(db)
    # get media
    media = media_repo.find_one_by({
        "$or": [{"id": media_id}, {"imdb_id": media_id}],
    })
    if not media:
        raise HTTPException(404, "media not found")
    # get tag
    tag = tag_repo.find_one_by({
        "$or": [{"id": tag_id}, {"name": tag_id}],
    })
    if not tag:
        raise HTTPException(404, "tag not found")
    # add vote
    tag_vote = tag_vote_repo.find_one_by({
        "media": media_id,
        "tag": tag.id,
        "created_by": current_user
    })
    if not tag_vote:
        tag_vote = model.TagVote(
            tag=tag.id,
            media=media_id,
            created_by=current_user,
        )
    tag_vote_repo.save(tag_vote)

@app.put("/api/media/{media_id}/removetag/{tag_id}")
def media_remove_tag(media_id: str, tag_id: str):
    pass

@app.get("/api/auth/check")
def auth_check(user_id: Annotated[str, DependsCurrentUser]):
    return str(user_id)

if __name__ == '__main__':
    # get_media_search(MediaSearchBody(query="person of"))
    pass