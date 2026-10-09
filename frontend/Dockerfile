# Base image for production
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Export static files for the host's Caddy service (no frontend container).
FROM scratch AS static
COPY --from=builder /app/dist /
