FROM node:latest

RUN \
  apt-get update && \
  apt-get install -y openjdk-7-jre && \
  rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
RUN npm install
COPY . /usr/src/app
RUN make batik

ENV MJAX_PORT 80
EXPOSE 80

CMD [ "npm", "start" ]
