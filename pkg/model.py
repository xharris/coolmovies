from pydantic import BaseModel
from bson import ObjectId
from pydantic_mongo import AbstractRepository, PydanticObjectId
from typing import List, Optional
from httpx import Client

class Media(BaseModel):
    id: PydanticObjectId = None
    title: str
    year: int
    img: str = None
    imdb_id: Optional[str] = None
    imdb_url: Optional[str] = None

class MediaSearchBody(BaseModel):
    query: str

class MediaRepo(AbstractRepository[Media]):
    class Meta:
        collection_name = 'medias'

    def search(self, body: MediaSearchBody) -> list[Media]:
        """Search medias by title."""
        pipeline = []
        return [
            Media(**doc) 
            for doc in self.get_collection().aggregate(pipeline)
        ]
    
class Tag(BaseModel):
    id: PydanticObjectId = None
    name: str
    