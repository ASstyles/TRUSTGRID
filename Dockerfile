# Multi-stage Docker build for TRUSTGRID Full-Stack Application
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy client dependencies and build frontend
COPY client/package*.json ./client/
RUN npm --prefix client ci

COPY . .
RUN npm --prefix client run build
RUN npm run build:server

# Production Runner
FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY src/database/schema.sql ./src/database/

EXPOSE 5000

CMD ["node", "dist/server.js"]
