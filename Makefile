# Sprint Tracker — Development commands
# Usage: make [target]

# Load nvm for node/npm access
SHELL := /bin/zsh
export NVM_DIR := $(HOME)/.nvm
NVM_LOAD := source $(NVM_DIR)/nvm.sh && nvm use 22 > /dev/null 2>&1

.PHONY: help install start stop restart dev db db-migrate db-reset db-push studio migrate-data status logs build clean

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: ## Install npm dependencies
	$(NVM_LOAD) && npm install

start: ## Start everything (Supabase + Vite dev server)
	@echo "Starting Supabase..."
	supabase start
	@echo ""
	@echo "Starting Vite dev server..."
	$(NVM_LOAD) && npm run dev

stop: ## Stop everything
	@echo "Stopping Supabase..."
	supabase stop
	@echo "Done."

restart: stop start ## Restart everything

dev: ## Start only the Vite dev server (Supabase must be running)
	$(NVM_LOAD) && npm run dev

db: ## Start only Supabase (database, auth, studio)
	supabase start

db-migrate: ## Apply pending migrations to local Supabase
	supabase migration up

db-reset: ## Reset local DB and re-apply all migrations from scratch
	supabase db reset

db-push: ## Push local migrations to remote Supabase project
	supabase db push

studio: ## Open Supabase Studio in browser
	@echo "Opening http://localhost:54323"
	@open http://localhost:54323 2>/dev/null || xdg-open http://localhost:54323 2>/dev/null || echo "Visit http://localhost:54323"

migrate-data: ## Import data.json into Supabase (usage: make migrate-data EMAIL=user@example.com)
	@if [ -z "$(EMAIL)" ]; then echo "Usage: make migrate-data EMAIL=user@example.com"; exit 1; fi
	$(NVM_LOAD) && node scripts/migrate-to-supabase.js $(EMAIL)

env: ## Generate .env.local from running Supabase instance
	@echo "# Auto-generated from supabase status" > .env.local
	@echo "VITE_SUPABASE_URL=$$(supabase status -o env | grep '^API_URL=' | cut -d'=' -f2 | tr -d '"')" >> .env.local
	@echo "VITE_SUPABASE_ANON_KEY=$$(supabase status -o env | grep '^ANON_KEY=' | cut -d'=' -f2 | tr -d '"')" >> .env.local
	@echo "SUPABASE_SERVICE_ROLE_KEY=$$(supabase status -o env | grep '^SERVICE_ROLE_KEY=' | cut -d'=' -f2 | tr -d '"')" >> .env.local
	@echo ".env.local updated."

status: ## Show Supabase services status
	supabase status

logs: ## Show Supabase service logs
	supabase logs

build: ## Build for production
	$(NVM_LOAD) && npm run build

clean: ## Remove node_modules and dist
	rm -rf node_modules dist
	@echo "Cleaned."
