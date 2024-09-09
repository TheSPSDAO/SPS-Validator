FROM debian:buster AS utils
RUN apt-get update -y && apt-get install dumb-init -y && rm -rf /var/lib/apt/lists/*

######################################################################
FROM node:20-buster as dev-dependencies
######################################################################
WORKDIR /app
# Required to compile secp256k1 C++
RUN apt-get update -y && apt-get install g++ make python3 -y && rm -rf /var/lib/apt/lists/*
ENV npm_config_python=/usr/bin/python3
ARG NPM_TOKEN
COPY npmrc.docker ./.npmrc
COPY package.json package-lock.json  ./
ENV DISABLE_OPENCOLLECTIVE=yes
RUN npm ci
RUN rm -f .npmrc

######################################################################
FROM node:20-buster AS builder
######################################################################
WORKDIR /app
COPY --from=dev-dependencies /app /app
COPY package.json package-lock.json nx.json tsconfig.base.json ./
COPY monad ./monad
COPY validator ./validator
COPY bridge ./bridge
COPY nft ./nft
COPY apps ./apps
COPY sqitch ./sqitch
COPY custom-json-queue ./custom-json-queue
RUN npx nx run sps-validator:build:production

######################################################################
FROM node:20-buster as prod-dependencies
######################################################################
WORKDIR /app
# Required to compile secp256k1 C++
RUN apt-get update -y && apt-get install g++ make python3 -y && rm -rf /var/lib/apt/lists/*
ENV npm_config_python=/usr/bin/python3
ARG NPM_TOKEN
COPY npmrc.docker ./.npmrc
COPY package-lock.json  ./
COPY --from=builder /app/dist/apps/sps-validator/package.json ./
ENV DISABLE_OPENCOLLECTIVE=yes
RUN npm ci --omit=dev
RUN rm -f .npmrc

######################################################################
FROM node:20-buster as final
######################################################################
RUN apt-get update -y && apt-get install sqitch libdbd-pg-perl postgresql-client -y && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node --from=utils /usr/bin/dumb-init /usr/bin/dumb-init

WORKDIR /app

ENV NODE_ENV=production
COPY --chown=node:node --from=prod-dependencies /app  .
COPY --chown=node:node --from=builder /app/dist/apps/sps-validator ./dist
COPY --chown=node:node --from=builder /app/sqitch ./sqitch
COPY --chown=node:node --from=builder /app/apps/sps-validator/all.entrypoint.sh ./

USER node

ENTRYPOINT ["./all.entrypoint.sh"]
