# Use official Node.js runtime
FROM node:18

# Set the working dir
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies 
RUN npm install

# Copy all files
COPY . .

# Run on port 3000
EXPOSE 7734

# Command for running application
CMD ["npm", "start"]
