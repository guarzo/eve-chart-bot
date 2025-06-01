# Multi-stage Dockerfile that supports both development and production builds
ARG NODE_VERSION=20
ARG BUILD_TARGET=production

# Development target
FROM node:${NODE_VERSION} AS development

# Install system dependencies for development
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    postgresql-client \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Install global development tools
RUN npm install -g pnpm nodemon typescript ts-node

# Set working directory
WORKDIR /workspace

# Create necessary directories
RUN mkdir -p /workspace/bot /workspace/admin-ui

# Set environment variables
ENV NODE_ENV=development
ENV PATH="/workspace/node_modules/.bin:${PATH}"

# Keep container running
CMD ["sleep", "infinity"]

# Production builder stage
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pkgconfig

# Copy package files and install dependencies
COPY bot/package*.json ./
RUN npm ci

# Copy prisma schema and migrations
COPY bot/prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the application
COPY bot/ .

# Build the application
RUN npm run build

# Production target
FROM node:${NODE_VERSION}-alpine AS production

WORKDIR /app

# Install production runtime dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pkgconfig \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman

# Create symlink for python
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Copy package files and install production dependencies only
COPY bot/package*.json ./
RUN npm ci --omit=dev

# Copy Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy prisma schema and migrations
COPY --from=builder /app/prisma ./prisma/

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]

# Final target based on BUILD_TARGET argument
FROM ${BUILD_TARGET} 