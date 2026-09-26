# syntax=docker/dockerfile:1

# ---- Development (ng serve with hot reload) ----
# Base images are pinned by digest; Dependabot (docker ecosystem) keeps them current.
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--poll", "2000"]

# ---- Production build ----
FROM dev AS build
RUN npm run build

# ---- Production runtime (unprivileged nginx, listens on 8080) ----
FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0 AS prod
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.inc.template /etc/nginx/security-headers.inc.template
COPY --chmod=755 nginx/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/dist/base-angular-dashboard/browser /usr/share/nginx/html
# Deployment settings (see nginx/40-runtime-config.sh)
ENV API_URL=/api
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
