ALL: deploy
.PHONY: layers deploy package validate

PROJECT := Math
ENVIRONMENT ?= Test
STACK_NAME ?= MathApi$(ENVIRONMENT)
PACKAGE_TEMPLATE := template.yml
PACKAGE_BUCKET ?= chialab-cloudformation-templates
PACKAGE_PREFIX ?= chialab/math-api/$(shell git symbolic-ref --short HEAD)

PACKAGE_PROFILE ?= chialabsrl
DEPLOY_PROFILE ?= chialab

layers:
	docker run --rm \
		-v $(PWD)/layers/mathjax-node-layer/nodejs:/var/task \
		-e NODE_ENV=production \
		lambci/lambda:build-nodejs8.10 \
		npm $(if $(wildcard layers/mathjax-node-layer/nodejs/node_modules/*), rebuild, install)

ensure-layer-%:
	@if ! [[ -d 'layers/$*/nodejs/node_modules' ]]; then \
		printf '\033[31mDependencies for layer \033[1m%s\033[22m are not installed, run \033[1m%s\033[22m first!\033[0m\n' $* 'make layers'; \
		exit 1; \
	fi

deploy: package
	aws cloudformation deploy \
		--template-file $(PACKAGE_TEMPLATE) \
		--stack-name $(STACK_NAME) \
		--tags Project=$(PROJECT) Environment=$(ENVIRONMENT) \
		--capabilities CAPABILITY_IAM \
		--profile $(DEPLOY_PROFILE)

package: ensure-layer-mathjax-node-layer validate
	aws cloudformation package \
		--template-file templates/root.yml \
		--output-template-file $(PACKAGE_TEMPLATE) \
		--s3-bucket $(PACKAGE_BUCKET) \
		--s3-prefix $(PACKAGE_PREFIX) \
		--profile $(PACKAGE_PROFILE)
	aws s3 cp $(PACKAGE_TEMPLATE) s3://$(PACKAGE_BUCKET)/$(PACKAGE_PREFIX)/ --profile $(PACKAGE_PROFILE)
	@echo "https://$(PACKAGE_BUCKET).s3.amazonaws.com/$(PACKAGE_PREFIX)/$(PACKAGE_TEMPLATE)"

validate:
	aws cloudformation validate-template \
		--template-body file://templates/root.yml \
		--profile $(PACKAGE_PROFILE)
