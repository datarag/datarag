GROUP_ID?=$$(if [ $$(id -g) = '20' ]; then echo 1111; else id -g; fi)
USER_ID?=$$(id -u)

TARGET_IMAGE=datarag
TARGET_TAG=latest

build_dev:
	make _build TARGET_IMAGE=datarag-devel

build_prod:
	make _build TARGET_IMAGE=datarag

_build:
	docker build \
		--build-arg USER_ID=${USER_ID} \
		--build-arg GROUP_ID=${GROUP_ID} \
		--target ${TARGET_IMAGE} \
		-t ${TARGET_IMAGE}:${TARGET_TAG} .

migrate:
	docker-compose run --rm datarag npm run migrate

migrate_undo:
	docker-compose run --rm datarag npm run migrate_undo

up:
	docker-compose up

test:
	docker-compose run --rm datarag npm test

eslint:
	docker-compose run --rm datarag npm run eslint

stop:
	docker-compose stop

shell:
	docker-compose run --rm datarag sh

dbshell:
	docker-compose run --rm datarag psql postgres://postgres:postgres@datarag-postgres:5432/datarag

delete:
	docker-compose down --rmi local -v
