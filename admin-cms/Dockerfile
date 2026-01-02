
# ===========================
# 1. Build Stage (Node + Vite)
# ===========================
FROM node:20 AS builder
WORKDIR /app

# Copy dependency files
COPY package.json ./

COPY .env .env

# Install dependencies (clean, reproducible)
RUN npm install

# Copy the rest of your project
COPY . .

# Build the Vite/React/FireCMS app
# This will generate the dist/ folder
ENV SKIP_TSC=true
RUN npm run build

# Nginx Stage (Serve Static Files)
# ===========================
FROM nginx:stable-alpine

# Remove default Nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy our custom nginx.conf from project root
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (container listens here)
EXPOSE 80

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
