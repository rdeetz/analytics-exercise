FROM node:22-alpine
WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json ./
RUN npm install

# App source. In docker-compose this is overlaid by a bind mount so edits
# hot-reload; the image copy is what makes the container runnable on its own.
COPY . .

EXPOSE 3000

# Watch-mode dev server (compose mounts ./api over /app for live editing).
CMD ["npm", "run", "start:dev"]
