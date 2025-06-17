FROM denoland/deno:1.43.3

# Install all dependencies in one layer
RUN apt-get update && \
    apt-get install -y \
        chromium \
        xvfb \
        fonts-noto-cjk \ 
    && rm -rf /var/lib/apt/lists/*

# Environment variables
ENV CHROME_BIN=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV DISPLAY=:99 

WORKDIR /app
COPY . .

# Start script with Xvfb
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x16 & deno run -A src/app.ts"]