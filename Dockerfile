# Multi-stage Dockerfile for STL-Storage Hub
FROM node:20-alpine AS build-client

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# Production server stage
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm install --omit=dev

COPY server/ ./server/
COPY --from=build-client /app/client/dist ./client/dist

# Expose HTTP port
EXPOSE 3001

# Volumes for persistent data
VOLUME ["/app/data"]

CMD ["node", "server/index.js"]
