ALL: package
.PHONY: layer validate package

S3_BUCKET ?= chialab-cloudformation-templates
S3_PREFIX ?= chialab/math-api

layer:
	docker run --rm \
		-v $(PWD)/layers/mathjax-node-layer/nodejs:/var/task \
		-e NODE_ENV=production \
		lambci/lambda:build-nodejs8.10 \
		npm $(if $(wildcard layers/mathjax-node-layer/nodejs/node_modules/*), rebuild, install)

validate:
	aws cloudformation validate-template \
		--template-body file://templates/root.yml

package: validate
	aws cloudformation package \
		--template-file templates/root.yml \
		--output-template-file template.yml \
		--s3-bucket $(S3_BUCKET) \
		--s3-prefix $(S3_PREFIX)
	aws s3 cp template.yml s3://$(S3_BUCKET)/$(S3_PREFIX)/
	@echo https://s3.amazonaws.com/$(S3_BUCKET)/$(S3_PREFIX)/template.yml
