.PHONY: help build clean

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

build: ## Builds extension
	jlpm run build

watch: ## Watches TS code
	jlpm run watch

clean:
	jlpm run clean
