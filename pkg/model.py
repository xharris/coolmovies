from pydantic import BaseModel, Field
from bson import ObjectId
from pydantic_mongo import AbstractRepository, PydanticObjectId
from typing import List, Optional, Dict
from httpx import Client
from enum import StrEnum

class MediaType(StrEnum):
    watch = 'watch'
    play = 'play'

class Media(BaseModel):
    class Stats(BaseModel):
        votes: Dict[str, int] = Field(default_factory=dict)
        '''tag votes — keys are tag id strings'''

    id: PydanticObjectId = None
    title: str
    year: int
    stats: Stats = Field(default_factory=Stats)
    type: MediaType = Field(default=MediaType.watch)
    img: Optional[str] = None
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
    
    def find_one_by_id(self, _id):
        return self.find_one_by({
            "$or": [{"_id": PydanticObjectId(_id)}, {"imdb_id": _id}],
        })

class UserRole(StrEnum):
    admin = 'admin'

class User(BaseModel):
    id: PydanticObjectId = None
    roles: List[UserRole] = Field(default_factory=list)

class UserRepo(AbstractRepository[User]):
    class Meta:
        collection_name = 'users'

class Tag(BaseModel):
    id: PydanticObjectId = None
    name: str
    created_by: PydanticObjectId
    description: str = ''
    theme: Optional[str] = None

class TagRepo(AbstractRepository[Tag]):
    class Meta:
        collection_name = 'tags'

    def ensure_indexes(self):
        self.get_collection().create_index("name", unique=True)

    def all(self) -> List[Tag]:
        return list(self.find_by({}))

    def find_one_by_id(self, _id):
        return self.find_one_by({ "$or": [{ "tag": _id }, { "_id": PydanticObjectId(_id) }] })
    
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
        votes = list(self.find_by({"media": media, "tag": tag, "created_by": created_by}))
        return [self.delete_by_id(v.id) for v in votes]