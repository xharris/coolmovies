# CoolMovies4U! - https://coolmovies.fly.dev/

- Search for media (movies, shows, anime)
- Filter media based on the vibe you're looking for
- Vote on 'vibe' tags that match a media
- No authentication required

![screenshot](./Screenshot%202026-05-24%20at%2010.24.12 PM.png)

## Tech stack

- Python's FastAPI
- Vite TypeScript + React UI
- MongoDB
- Hosted on fly.io

## Notes

### Backup

`mongodump --uri="<connection-string>" --db=<db-name> --gzip --archive="backup-$(date +%F).gz"`
