all:
	@echo 'Create upload files dir.'
	mkdir -p /srv/gargantua/uploads
	chmod -R 775 /srv/gargantua

	@echo 'Install'
	python setup.py develop

nose:
	@# nosetests -vs --logging-level=DEBUG --with-coverage --cover-package=gargantua tests
	nosetests -vs --logging-level=DEBUG tests

changelog:
	sh ./.scripts/generate_changelog.sh