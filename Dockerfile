# Stage 1: Build frontend
FROM node:22-slim AS frontend
WORKDIR /app/web
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

# Stage 2: Python runtime
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS runtime
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY main.py ./
COPY pkg/ ./pkg/
COPY --from=frontend /app/web/dist ./web/dist
CMD ["uv", "run", "fastapi", "run", "main.py", "--host", "0.0.0.0", "--port", "8000"]
