FROM denoland/deno:latest

RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \  # More stable in cloud
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_ARGS="\
  --no-sandbox \
  --disable-setuid-sandbox \
  --disable-dev-shm-usage \
  --single-process \  # Critical for low-memory envs
  --no-zygote \
  --disable-gpu"

WORKDIR /app
COPY . .

# Cache Deno dependencies
RUN deno cache src/app.ts

CMD ["deno", "run", "-A", "--unstable", "src/app.ts"]