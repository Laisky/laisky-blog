all:
	@echo 'Create upload files dir.'
	mkdir -p /srv/gargantua/uploads
	chmod -R 775 /srv/gargantua

	@echo 'Install'
	python setup.py develop

config:
	mkdir -p /var/lib/mongodb
	mkdir -p /var/lib/fluentd
	mkdir -p /etc/fluentd
	cp -f ./deploy/fluent.conf /etc/fluentd/fluent.conf

nose:
	@# nosetests -vs --logging-level=DEBUG --with-coverage --cover-package=gargantua tests
	nosetests -vs --logging-level=DEBUG tests

changelog: CHANGELOG.md
	sh ./.scripts/generate_changelog.sh
