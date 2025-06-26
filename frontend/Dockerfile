# --- Stage 1: Build the Angular application ---
    FROM node:18-slim as builder

    WORKDIR /app
    
    # Copy package files and install all dependencies (incl. devDependencies for building)
    COPY package*.json ./
    RUN npm install
    
    # Copy the rest of the frontend source code
    COPY . .
    
    # Run the Angular build command to generate the static files
    RUN npm run build -- --configuration production
    
    
    # --- Stage 2: Create the final, lightweight production image ---
    FROM node:18-slim
    
    WORKDIR /usr/src/app
    
    # Copy package files and install ONLY production dependencies
    COPY package*.json ./
    RUN npm ci --omit=dev
    
    # Copy the server.js file
    COPY server.js .
    
    # --- THIS IS THE CRITICAL FIX ---
    # Copy the built Angular app from the 'builder' stage into a simple 'public' directory
    COPY --from=builder /app/dist/sow-forge-app/browser/ ./public/
    
    # Your app binds to port 8080
    EXPOSE 8080
    
    # Define the command to run your app
    CMD [ "node", "server.js" ]