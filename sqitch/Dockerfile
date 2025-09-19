FROM sqitch/sqitch:v1.5.1
USER root
RUN apt-get -qq update && apt-get -qq install unzip && rm -rf /var/cache/apt/* /var/lib/apt/lists/*
ARG snapshot
RUN ["/bin/bash", "-c", ": ${snapshot:?Build argument snapshot needs to be set and not null.}"]

WORKDIR /app
COPY deploy ./deploy
COPY verify ./verify
COPY revert ./revert
COPY sqitch* ./
COPY *.sh ./

ADD $snapshot /app/snapshot
ENV SNAPSHOT_ZIP=/app/snapshot
ENV SNAPSHOT=/app/snapshot_extracted

# Install PostgreSQL 16 client from official PostgreSQL repository
RUN apt-get -qq update && \
    apt-get install -y wget ca-certificates gnupg lsb-release && \
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - && \
    echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    apt-get -qq update && \
    apt-get install -y postgresql-client-16 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN chown -R sqitch /app
USER sqitch
ENTRYPOINT ["/bin/bash"]
CMD ["./docker-entrypoint.sh"]
