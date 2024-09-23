FROM node:22-bullseye AS vitebuilder

WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
ADD package*.json ./
ADD node_modules ./node_modules

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

FROM nginx:1.21.3-alpine

COPY --from=vitebuilder /app/dist /app
ADD ./assets/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
