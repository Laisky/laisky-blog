FROM node:22-bullseye AS vitebuilder

WORKDIR /app

# yarn already installed in the node image
# RUN npm install -g yarn

# Copy package.json and package-lock.json first to leverage Docker cache
ADD package.json ./
ADD yarn.lock ./

# Install dependencies
RUN yarn install

# Copy the rest of the application code
COPY . .

# Build the application
RUN yarn build

FROM nginx:1.21.3-alpine

COPY --from=vitebuilder /app/dist /app
ADD ./deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
