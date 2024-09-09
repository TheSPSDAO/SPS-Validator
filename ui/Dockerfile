FROM node:14-alpine3.15 AS build

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH

COPY package.json ./
COPY package-lock.json ./

RUN npm ci --silent

COPY ./openapi.yaml ./openapi.yaml
RUN npm run generate:openapi

COPY . ./
ENV REACT_APP_API_URL http://validator:3333/

RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/config.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
