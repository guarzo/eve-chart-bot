FROM mcr.microsoft.com/devcontainers/javascript-node:18

# Install system dependencies
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    postgresql-client \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Install global npm packages
RUN npm install -g pnpm

# Set working directory
WORKDIR /workspace

# Create necessary directories
RUN mkdir -p /workspace/bot /workspace/admin-ui

# Set environment variables
ENV NODE_ENV=development
ENV PATH="/workspace/node_modules/.bin:${PATH}"

# Install development tools
RUN npm install -g nodemon typescript ts-node

# Set up shell
SHELL ["/bin/bash", "-c"] 