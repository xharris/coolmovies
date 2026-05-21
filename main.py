from fastapi import FastAPI, HTTPException
from pkg import model, fmdb
from pymongo import MongoClient
from typing import List, Dict
from pydantic import BaseModel
from os import environ
from logging import getLogger, basicConfig, INFO

basicConfig()
log = getLogger(__name__)
log.setLevel(INFO)

app = FastAPI()
client = MongoClient(environ.get("MONGODB_URL"))
db = client.get_database(environ.get("MONGODB_NAME"))

class MediaSearchBody(BaseModel):
    query: str

@app.get("/api/media/search")
def get_media_search(body: MediaSearchBody):
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
                medias.append(m)
            else:
                medias.append(media)
        except Exception as e:
            log.warning("could not parse fmdb item:\nitem=%s\n%s", item, e)
    repo.save_many(medias)
    return medias

class VoteMediaTagBody(BaseModel):
    pass

def vote_media_tag():
    pass

if __name__ == '__main__':
    # get_media_search(MediaSearchBody(query="person of"))
    pass