# ===================================================
# SAFAR Frontend Dockerfile - Multi-Stage Build
# ===================================================

# Build stage
FROM node:20-bullseye-slim AS build
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

ARG REACT_APP_API_URL=""
ARG REACT_APP_SOCKET_URL=""
ARG REACT_APP_GOOGLE_MAPS_API_KEY=""

ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_SOCKET_URL=$REACT_APP_SOCKET_URL
ENV REACT_APP_GOOGLE_MAPS_API_KEY=$REACT_APP_GOOGLE_MAPS_API_KEY

RUN npm run build

# Production stage with Nginx
FROM nginx:alpine AS production
COPY --from=build /usr/src/app/build /usr/share/nginx/html

# Nginx config for SPA routing and proxy
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://server:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://server:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
    }
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
