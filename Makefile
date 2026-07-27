.PHONY: docker-build docker-push docker-build-push docker-inspect

DOCKER ?= docker
REGISTRY ?= hub-test.service.ucloud.cn/logsplatfrom
IMAGE_NAME ?= novaapm-frontend
TAG ?= 0.1.4
PLATFORM ?= linux/amd64
IMAGE ?= $(REGISTRY)/$(IMAGE_NAME):$(TAG)

docker-build:
	$(DOCKER) buildx build --platform $(PLATFORM) --load -t $(IMAGE) .

docker-push:
	$(DOCKER) push $(IMAGE)

docker-build-push:
	$(DOCKER) buildx build --platform $(PLATFORM) --push -t $(IMAGE) .

docker-inspect:
	$(DOCKER) image inspect $(IMAGE) --format '{{.Os}}/{{.Architecture}}'
