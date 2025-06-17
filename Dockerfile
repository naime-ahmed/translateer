FROM denoland/deno:latest

# Install dependencies in single RUN command
RUN apt-get update && \
    apt-get install -y \
        chromium \
        chromium-sandbox \
    && rm -rf /var/lib/apt/lists/*

# Environment variables (single line each)
ENV CHROME_BIN=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_ARGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --single-process --no-zygote --disable-gpu"

WORKDIR /app

COPY . .

# Cache dependencies
RUN deno cache src/app.ts

CMD ["deno", "run", "-A", "--unstable", "src/app.ts"]