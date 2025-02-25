FROM postgres:16.8-bullseye

ENV POSTGRES_DB ""
ENV POSTGRES_USER ""
ENV POSTGRES_PASSWORD ""
ENV VALIDATOR_DB ""

RUN apt-get update && apt-get -y install postgresql-16-cron && apt-get -y install postgresql-16-partman

COPY ./setup-preload.sh /docker-entrypoint-initdb.d/
