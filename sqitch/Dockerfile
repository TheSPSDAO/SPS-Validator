FROM sqitch/sqitch:v1.5.0
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
ADD $snapshot /app/snapshot.zip
ENV SNAPSHOT_ZIP=/app/snapshot.zip
ENV SNAPSHOT=/app/snapshot.sql

RUN chown -R sqitch /app
USER sqitch
ENTRYPOINT ["/bin/bash"]
CMD ["./docker-entrypoint.sh"]
