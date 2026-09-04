.PHONY: install dev backend frontend lint test build compose-up compose-down

install:
	npm ci
	python3.12 -m venv backend/.venv
	backend/.venv/bin/pip install -e './backend[dev]'

dev:
	docker compose --env-file .env up --build

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload

frontend:
	npm run dev

lint:
	npm run lint
	cd backend && .venv/bin/ruff check .

test:
	npm run typecheck
	cd backend && .venv/bin/pytest

build:
	npm run build

compose-up:
	docker compose --env-file .env up --build -d

compose-down:
	docker compose --env-file .env down
