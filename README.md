# Nodejs websocket consumer pulsar msg sdk example

## Environment

+ Nodejs >= 12.0
+ yarn

## Start

1. Install
```bash
yarn
```

2. Build
```bash
yarn build
```

3. Publish
```bash
yarn deploy
```

## Run example

1. Install
```bash
yarn
```

2. Config your accessId and accessKey in `example/index.js`

```js
const client = new TuyaWebsocket({
  accessId: "your accessId",
  accessKey: "your accessKey",
  url: TuyaWebsocket.URL.CN,
  env: TuyaWebsocket.env.PROD,
  maxRetryTimes: 100,
});
```

3. Start
```bash
yarn example
```

## Example code

```js
import TuyaWebsocket from "xxx";

const client = new TuyaWebsocket({
  accessId: "your accessId",
  accessKey: "your accessKey",
  url: TuyaWebsocket.URL.CN,
  env: TuyaWebsocket.env.PROD,
  maxRetryTimes: 100,
});

client.open(() => {
  console.log('open');
});

client.message((ws, message) => {
  client.ackMessage(message.messageId);
  console.log('message', message);
});

client.reconnect(() => {
  console.log('reconnect');
});

client.ping(() => {
  console.log('ping');
});

client.pong(() => {
  console.log('pong');
});

client.close((ws, ...args) => {
  console.log('close', ...args);
});

client.error((ws, error) => {
  console.log('error', error);
});

client.start() // 开始接收消息

```