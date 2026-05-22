from httpx import Client
from . import env
from typing import List

class FMDB(Client):
    def search_imdb(self, q: str):
        return self.get("https://imdb.iamidiotareyoutoo.com/search", params={
            "q": q,
        })

class TheGamesDB(Client):
    def games_by_game_name(self, name: str, fields: List[str] = []):
        API_KEY = env.mustgetenv('THE_GAMES_DB_API_KEY')
        return self.get("https://api.thegamesdb.net/v1/Games/ByGameName", params={
            "apikey": API_KEY,
            "name": name,
            "fields": ",".join(fields),
        })