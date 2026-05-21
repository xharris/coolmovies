from httpx import Client

class FMDB(Client):
    def search_imdb(self, q: str):
        return self.get("https://imdb.iamidiotareyoutoo.com/search", params={
            "q": q,
        })
