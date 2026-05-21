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

    def search(self, body: MediaSearchBody) -> List[Media]:
        """Search medias by title."""
        pipeline = []
        return [
            Media(**doc) 
            for doc in self.get_collection().aggregate(pipeline)
        ]

class User(BaseModel):
    id: PydanticObjectId = None

class UserRepo(AbstractRepository[User]):
    class Meta:
        collection_name = 'users'

    def authenticate(self, session_token: str):
        pass

class Tag(BaseModel):
    id: PydanticObjectId = None
    name: str

class TagRepo(AbstractRepository[Tag]):
    class Meta:
        collection_name = 'tags'
    
    def all(self) -> List[Tag]:
        return [
            Tag(**doc)
            for doc in self.get_collection().find()
        ]
    
class TagVote(BaseModel):
    id: PydanticObjectId = None
    media: PydanticObjectId
    tag: PydanticObjectId
    created_by: PydanticObjectId

class TagVoteRepo(AbstractRepository[TagVote]):
    class Meta:
        collection_name = 'tagvotes'

    def add_vote(self, media: PydanticObjectId, tag: PydanticObjectId, created_by: PydanticObjectId):
        doc = self.find_one_by({"media": media, "tag": tag, "created_by": created_by})
        vote = TagVote(**doc)
        vote.media = media
        vote.tag = tag
        vote.created_by = created_by
        return self.save(vote)
    
    def delete_vote(self, media: PydanticObjectId, tag: PydanticObjectId, created_by: PydanticObjectId):
        votes = [
            TagVote(**doc)
            for doc in self.find_by({"media": media, "tag": tag, "created_by": created_by})
        ]
        return [
            self.delete_by_id(v.id)
            for v in votes
        ]