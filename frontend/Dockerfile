# Web app: build with Node, serve with nginx. Build context: the repository root
# (the app imports ../shared/fixtures for its Examples menu).
FROM node:22-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY shared/ /app/shared/
RUN npm run build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
