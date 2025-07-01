# ---- Build Stage ----
# Use a specific Node.js LTS version for reproducibility.
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files and install ALL dependencies, including devDependencies,
# in case there are build scripts that need them.
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the application source code
COPY . .


# ---- Production Stage ----
# Start from a fresh, clean base image
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy the synchronized package files from the builder stage
COPY --from=builder /usr/src/app/package*.json ./

# THIS IS THE KEY: Run a clean, production-only install.
# It will use the synchronized package-lock.json and skip devDependencies.
RUN npm ci --omit=dev

# Copy only the built application code from the builder stage,
# excluding the dev-heavy node_modules from that stage.
COPY --from=builder /usr/src/app .

# Expose the port the app runs on
EXPOSE 8080

# Set the environment to production
ENV NODE_ENV=production

# The command to run when the container starts
CMD [ "node", "server.js" ]