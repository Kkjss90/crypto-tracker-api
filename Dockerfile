FROM node:26-alpine AS base
WORKDIR /app
RUN apk add --no-cache tini

FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM base AS prod-deps
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

FROM base AS prod
ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

RUN addgroup -S app && adduser -S app -G app \
 && mkdir -p /data && chown -R app:app /data /app
USER app

ENV PORT=3000 \
    DB_PATH=/data/app.db
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/Server.js"]

FROM deps AS dev
ENV NODE_ENV=development
COPY . .

ENV PORT=3000 \
    DB_PATH=/data/app.db
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "dev"]

FROM deps AS test
COPY . .
CMD ["npm", "test"]
