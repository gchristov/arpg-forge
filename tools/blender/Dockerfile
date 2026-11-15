FROM debian:bookworm-slim
# Blender converts models only published as FBX into glTF; it runs headless, so no display is needed.
RUN apt-get update && apt-get install -y --no-install-recommends blender python3-numpy && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
ENTRYPOINT ["blender", "--background", "--factory-startup", "--python-exit-code", "1"]
