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

- [ ] IP rate limiting with redis
- [ ] Add 'theme' field to Tag (for data-theme)
- [ ] Add 'description' field to Tag
- [ ] UI tag editor
- [ ] Sort homepage medias by year
- [ ] Figure out how to resolve duplicate entries in IMDB/game db (also hook up game db)
- [ ] Use tag themes in add/remove tag form?
- [ ] Log into existing account using sync code/QR code from another device?
  - [ ] Update created_by of other docs
  - [ ] Remove old account

## AI Notes

1. Cloudflare Turnstile (free, low friction) — kills most bots
2. IP rate limiting with Redis (e.g., 1 vote per IP per 24h)
3. Signed session token — prevents double-submit from same load
4. localStorage/cookie flag — stops casual refresh spam
