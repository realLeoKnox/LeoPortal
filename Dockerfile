# Use the lightweight official Node.js Alpine image
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests
COPY package.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy the rest of the application files
COPY . .

# Expose the default application port
EXPOSE 8080

# Command to start the application
CMD ["npm", "start"]
