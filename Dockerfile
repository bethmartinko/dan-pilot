# DAN container image for Google Cloud Run.
#
# Layers are ordered for cache hits on the common case (editing
# index.html or prompt files). Dependency install only re-runs when
# package.json or package-lock.json change.

FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
