ARG NODE_VERSION=8.10
FROM node:${NODE_VERSION}

ARG NODE_ENV=production
ENV PORT=3000 NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app
COPY package.json yarn.lock /usr/src/app/
RUN yarn install
COPY . /usr/src/app

EXPOSE 3000

CMD [ "yarn", "start" ]
