# Multi-stage Dockerfile for CapRover & Standalone Docker deployments
FROM node:20-alpine AS build-client

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# Production server stage
FROM node:20-alpine

# Install build dependencies for native sqlite3 bindings if needed
RUN apk add --no-cache python3 make g++

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80

COPY package*.json ./
RUN npm install --omit=dev

COPY server/ ./server/
COPY assets/ ./assets/
COPY --from=build-client /app/client/dist ./client/dist

# Expose HTTP ports (80 for CapRover default, 3001 for standalone Docker)
EXPOSE 80 3001

# Persistent volume for SQLite database, 3D files and watch import
VOLUME ["/app/data"]

CMD ["node", "server/index.js"]
