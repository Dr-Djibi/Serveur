# Utilise une image Node.js légère
FROM node:20-bullseye-slim

# Installe les dépendances système nécessaires
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Dossier de travail
WORKDIR /app

# Copie les fichiers de dépendances et installe
COPY package.json .
RUN npm install

# Copie le reste des fichiers
COPY . .

# Port exposé par le serveur
EXPOSE 8000

# Commande de démarrage
CMD ["npm", "start"]