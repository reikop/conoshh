FROM node:16-alpine

RUN apk add  --no-cache ffmpeg

RUN mkdir -p /usr/src/bot
WORKDIR /usr/src/bot

COPY package.json /usr/src/bot
RUN npm install
COPY . /usr/src/bot

ENTRYPOINT node index.js --key=$DISCORD_TOKEN