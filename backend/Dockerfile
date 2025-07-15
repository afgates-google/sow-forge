# ---- Build Stage ----
# Use a specific Node.js LTS version for reproducibility.
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files and install ALL dependencies, including devDependencies,
# in case there are build scripts that need them.
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the application source code
COPY server.js .
RUN ls -l


# ---- Production Stage ----
# Start from a fresh, clean base image
FROM node:20-alpine
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /usr/src/app .
RUN ls -l
EXPOSE 8080
ENV NODE_ENV=production
CMD [ "node", "server.js" ]