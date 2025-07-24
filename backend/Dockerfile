# Simple Railway-compatible Dockerfile
FROM node:18-alpine

# Install dumb-init
RUN apk add --no-cache dumb-init

# Set working directory  
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application  
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S appuser -u 1001
RUN chown -R appuser:nodejs /app
USER appuser

# Expose port
EXPOSE 3001

# Start with migrations
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]