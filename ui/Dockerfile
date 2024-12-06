FROM node:14-alpine3.15 AS build

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH

COPY package.json ./
COPY package-lock.json ./

RUN npm ci --silent

COPY ./openapi.yaml ./openapi.yaml
RUN npm run generate:openapi

COPY . ./

ARG VALIDATOR_API_URL "http://localhost:3333/"
ARG VALIDATOR_PREFIX "sm_"

ENV VALIDATOR_API_URL=$VALIDATOR_API_URL
ENV VALIDATOR_PREFIX=$VALIDATOR_PREFIX

RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
