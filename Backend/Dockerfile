# Statically-linked ffmpeg/ffprobe binaries, copied in below instead of apt-installing
# the "ffmpeg" package: on Debian that package pulls in ~265 transitive packages
# (X11, Vulkan, PulseAudio, SDL2, etc. for its GUI tools) that a headless API doesn't need.
FROM mwader/static-ffmpeg:7.1 AS ffmpeg

FROM python:3.10-slim

# Prevents apt/debconf from blocking on an interactive prompt during the build
ENV DEBIAN_FRONTEND=noninteractive

COPY --from=ffmpeg /ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg /ffprobe /usr/local/bin/ffprobe

# System dependencies:
# - libgomp1: OpenMP runtime needed by tensorflow/torch/parselmouth
# - curl: used by the container healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first so this layer is cached unless requirements.txt changes.
# torch is installed from the CPU-only wheel index first: the app only ever runs models on
# CPU (see faster_whisper's device="cpu"), but the default PyPI wheel bundles the full CUDA/
# cuDNN/NCCL toolkit (many GB); pre-satisfying it here keeps the plain requirements.txt install
# below from pulling that in.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch==2.11.0 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code (see .dockerignore for excluded paths, e.g. data/model)
COPY . .

EXPOSE 8080

# start-period is long because first-run startup downloads the BERT encoder
# (cl-tohoku/bert-base-japanese-v2) from Hugging Face and loads the 1.3GB GEC
# checkpoint before the server can accept requests; later starts are cached
# (see the backend_cache volume in docker-compose.yml) and come up much faster.
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# main.py's app() is an application factory (not an ASGI instance),
# so it must be launched with uvicorn's --factory flag.
CMD ["uvicorn", "main:app", "--factory", "--host", "0.0.0.0", "--port", "8080"]
