.PHONY: build deploy

DOCKER_TAG?=mathjax-node
ENVIRONMENT?=production

build:
	@docker build -t $(DOCKER_TAG) .

batik:
	@if [ ! -f batik.tar.gz ]; then \
		curl -o batik.tar.gz http://apache.panu.it/xmlgraphics/batik/binaries/batik-bin-1.8.tar.gz; \
	fi
	@tar -xvf batik.tar.gz
	@mv batik-1.8/* node_modules/mathjax-node/batik/
	@ln -s batik-rasterizer-1.8.jar node_modules/mathjax-node/batik/batik-rasterizer.jar

deploy:
	git archive --output=archive.zip HEAD
	eb deploy --staged $(ENVIRONMENT)
