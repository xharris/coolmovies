from httpx import Client
from httpx._config import DEFAULT_LIMITS, DEFAULT_MAX_REDIRECTS, DEFAULT_TIMEOUT_CONFIG
from . import env, model
from typing import List
from logging import getLogger
from datetime import date

log = getLogger(__name__)

IMDB_URL = 'https://www.imdb.com/title/{imdb_id}/'

class Movies(Client):
    api_token: str

    def __init__(self, *, api_token:str, auth = None, params = None, headers = None, cookies = None, verify = True, cert = None, trust_env = True, http1 = True, http2 = False, proxy = None, mounts = None, timeout = DEFAULT_TIMEOUT_CONFIG, follow_redirects = False, limits = DEFAULT_LIMITS, max_redirects = DEFAULT_MAX_REDIRECTS, event_hooks = None, base_url = "", transport = None, default_encoding = "utf-8"):
        self.api_token = api_token
        headers = headers or {}
        headers.setdefault('Authorization', f'Bearer {self.api_token}')
        super().__init__(auth=auth, params=params, headers=headers, cookies=cookies, verify=verify, cert=cert, trust_env=trust_env, http1=http1, http2=http2, proxy=proxy, mounts=mounts, timeout=timeout, follow_redirects=follow_redirects, limits=limits, max_redirects=max_redirects, event_hooks=event_hooks, base_url=base_url, transport=transport, default_encoding=default_encoding)

    def search(self, q: str) -> List[model.Media]:
        out: List[model.Media] = []
        # search movies
        resp_movies = self.get('https://api.themoviedb.org/3/search/movie', params={'query': q})
        resp_movies.raise_for_status()
        json_movies = resp_movies.json()
        # search shows
        resp_tv = self.get('https://api.themoviedb.org/3/search/tv', params={'query': q})
        resp_tv.raise_for_status()
        json_tv = resp_tv.json()

        results = [*json_movies['results'], *json_tv['results']]
        today = date.today()

        for result in results:
            is_tv = 'first_air_date' in result
            # get external ids
            resp2 = \
                self.get('https://api.themoviedb.org/3/tv/{series_id}/external_ids'.format(series_id=result['id'])) if is_tv else\
                self.get('https://api.themoviedb.org/3/movie/{movie_id}/external_ids'.format(movie_id=result['id']))
            resp2.raise_for_status()
            json_data2 = resp2.json()

            str_release_date = result['first_air_date'] if is_tv else result['release_date']
            if len(str_release_date) == 0:
                continue
            release_date = date.fromisoformat(str_release_date)
            if release_date.year is None or release_date.year > today.year or not 'imdb_id' in json_data2:
                continue

            # get details
            resp_details = \
                self.get('https://api.themoviedb.org/3/tv/{series_id}'.format(series_id=result['id'])) if is_tv else\
                self.get('https://api.themoviedb.org/3/movie/{movie_id}'.format(movie_id=result['id']))
            resp_details.raise_for_status()
            json_details = resp_details.json()

            media = model.Media(
                title =  result['name'] if is_tv else result['title'],
                year = release_date.year,
                img = 'https://image.tmdb.org/t/p/w500/%s' % (result['poster_path']),
                type = model.MediaType.watch,
                popularity = json_details['popularity']
            )
            # get external ids
            media.imdb_id = json_data2['imdb_id']
            media.imdb_url = IMDB_URL.format(imdb_id=media.imdb_id)
            if media.imdb_id is None:
                log.info("BAD MOVIE: %s" % (media))
            out.append(media)
        return out

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