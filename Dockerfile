# Stage 1: Build environment
FROM node:20-alpine AS builder

# Install build tools needed for native dependencies and pino
RUN apk add --no-cache python3 make g++ ffmpeg

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci

# Copy the rest of the app
COPY . .

# Stage 2: Production environment
FROM node:20-alpine

# FFmpeg is often required for audio/video features in Baileys
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy isolated node_modules and app files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/index.js ./
COPY --from=builder /app/bot.js ./

# Set environment to production
ENV NODE_ENV=production
ENV PORT=8000

# Run as non-root user for better security (standard practice)
USER node

EXPOSE 8000

CMD ["node", "index.js"]
