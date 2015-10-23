all:
	mkdir -p /var/log/gargantua
	mkdir -p /srv/gargantua/uploads
	chmod -R 777 /var/log/gargantua
	chmod -R 777 /srv/gargantua

nose:
	nosetests -vs --logging-level=DEBUG --with-coverage --cover-package=gargantua tests
