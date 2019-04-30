FROM node:latest

ENV PORT=3000 NODE_ENV=production

WORKDIR /usr/src/app
COPY package.json yarn.lock /usr/src/app/
RUN yarn install
COPY . /usr/src/app

EXPOSE 3000

CMD [ "yarn", "start" ]
