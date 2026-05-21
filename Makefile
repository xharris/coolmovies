dev:
	@trap 'kill 0' INT; \
	UV_ENV_FILE=.env uv run fastapi dev & \
	cd web && pnpm dev & \
	wait

main:
	UV_ENV_FILE=.env uv run -m main