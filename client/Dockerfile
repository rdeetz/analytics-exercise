FROM node:22-alpine
WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json ./
RUN npm install

# App source (overlaid by a bind mount in docker-compose for HMR).
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
