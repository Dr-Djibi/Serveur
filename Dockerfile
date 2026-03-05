FROM node:20-bullseye-slim

# Install necessary tools (ffmpeg might be needed by Baileys for media processing)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy project files
COPY . .

# Expose port
EXPOSE 8000

# Start script
CMD ["npm", "start"]
