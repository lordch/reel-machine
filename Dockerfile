FROM node:22-slim

# ffmpeg for audio/video processing + Chromium for Remotion render
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    chromium \
    fonts-liberation \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Remotion needs this to find Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3001

CMD ["npx", "tsx", "src/api/server.ts"]
