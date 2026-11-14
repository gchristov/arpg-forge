FROM node:26-bookworm-slim
# unzip unpacks asset packs that are only published as zip files (tools/assets/build-models.mjs).
RUN apt-get update && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
