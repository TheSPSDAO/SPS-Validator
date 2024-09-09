FROM alpine:3.18 AS utils
RUN apk add --no-cache dumb-init

######################################################################
FROM node:20-alpine3.18 as dev-dependencies
######################################################################
WORKDIR /app
# Required to compile secp256k1 C++
RUN apk add --no-cache g++ make python3
ENV npm_config_python=/usr/bin/python3
ARG NPM_TOKEN
COPY npmrc.docker ./.npmrc
COPY package.json package-lock.json ./
ENV DISABLE_OPENCOLLECTIVE=yes
RUN npm ci
RUN rm -f .npmrc

######################################################################
FROM node:20-alpine3.18 AS builder
######################################################################
WORKDIR /app
COPY --from=dev-dependencies /app /app
COPY package.json package-lock.json nx.json tsconfig.base.json ./
COPY monad ./monad
COPY validator ./validator
COPY bridge ./bridge
COPY nft ./nft
COPY apps ./apps
COPY custom-json-queue ./custom-json-queue
RUN npx nx run sps-validator:build:production

######################################################################
FROM node:20-alpine3.18 as prod-dependencies
######################################################################
WORKDIR /app
# Required to compile secp256k1 C++
RUN apk add --no-cache g++ make python3
ENV npm_config_python=/usr/bin/python3
ARG NPM_TOKEN
COPY npmrc.docker ./.npmrc
COPY package-lock.json ./
COPY --from=builder /app/dist/apps/sps-validator/package.json ./
ENV DISABLE_OPENCOLLECTIVE=yes
RUN npm ci --omit=dev
RUN rm -f .npmrc

######################################################################
FROM node:20-alpine3.18 as final
######################################################################
COPY --from=utils /usr/bin/dumb-init /usr/bin/dumb-init
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-dependencies /app  .
COPY --from=builder /app/dist/apps/sps-validator ./dist
ENTRYPOINT ["/usr/bin/dumb-init", "--", "node", "./dist/main.js"]
