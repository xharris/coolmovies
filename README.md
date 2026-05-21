## Goals

- Search medias
  - Movies
  - Shows
  - Anime
  - Games
- Rate medias
  - categories: trippy, funny, confusing, cozy
  - warnings: sad, scary, loud
  - upvote / downvote system
- Auth
  - store tag ID cookie

## TODO

- [ ] Api
  - [ ] Anonymous account cookie
    - [ ] UUID
    - [ ] session cookie
  - [ ] Search media
    - [x] movie/show db
    - [ ] anime db
    - [ ] game db
    - [ ] Store media in DB: src(url), img, title, description
  - [ ] Vote on tag for media
    - [ ] Look into:
      - [ ] IP rate limiting with redis
      - [ ] signed session token

## AI Notes

1. Cloudflare Turnstile (free, low friction) — kills most bots
2. IP rate limiting with Redis (e.g., 1 vote per IP per 24h)
3. Signed session token — prevents double-submit from same load
4. localStorage/cookie flag — stops casual refresh spam
