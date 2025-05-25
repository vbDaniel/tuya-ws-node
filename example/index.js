/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const TuyaWebsocket = require('../dist').default;

const client = new TuyaWebsocket({
  accessId: '9kvy387xyr9u5d4kvy93',
  accessKey: '3a0c38e4f7024b65a4d30e5565fba660',
  url: TuyaWebsocket.URL.US,
  env: TuyaWebsocket.env.TEST,
  maxRetryTimes: 100,
});

client.open(() => {
  console.log('open');
});

client.message((ws, message) => {
  client.ackMessage(message.messageId);

  console.log('ackMessage', message.messageId);
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

client.start(); // 开始接收消息
