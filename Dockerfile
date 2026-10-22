FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
ARG BUILD_MODE=production
ARG VITE_API_BASE_URL=
ARG VITE_SESSION_IDLE_TIMEOUT_MINUTES=15
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SESSION_IDLE_TIMEOUT_MINUTES=${VITE_SESSION_IDLE_TIMEOUT_MINUTES}
RUN npm run build -- --mode ${BUILD_MODE}

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html
COPY --chown=101:101 deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
