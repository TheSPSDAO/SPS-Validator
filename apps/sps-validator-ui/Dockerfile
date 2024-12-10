FROM node:23.3-alpine3.20 AS build

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH

COPY package.json package-lock.json ./
RUN npm ci --silent

COPY . ./

ARG VALIDATOR_API_URL "http://localhost:3333/"
ARG VALIDATOR_PREFIX "sm_"

ENV VALIDATOR_API_URL=$VALIDATOR_API_URL
ENV VALIDATOR_PREFIX=$VALIDATOR_PREFIX

RUN npx nx build sps-validator-ui --configuration=production

FROM nginx:stable-alpine
COPY --from=build /app/dist/apps/sps-validator-ui/ /usr/share/nginx/html
COPY /apps/sps-validator-ui/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
