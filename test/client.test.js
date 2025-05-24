const Websocket = require('ws');
const TuyaWebsocket = require('../src').default;
const { accessKey, accessId, originData, encryptCode } = require('./const');

const port = 8080;
const wsUrl = `http://localhost:${port}/`;

const MSG_ERROR = 'error';
const MSG_TEST = 'message';
const MSG_PING = 'ping';

const commonMessage = {
  protocol: 4,
  pv: '2.0',
  sign: 'signsignsignsign',
  t: 1622449865378,
};

const message = {
  messageId: 'messageId',
  payload: Buffer.from(
    JSON.stringify({
      ...commonMessage,
      data: encryptCode,
    }),
  ).toString('base64'),
};

const decryptMessage = {
  messageId: 'messageId',
  payload: {
    ...commonMessage,
    data: originData,
  },
};

function buildWebsocketServer() {
  const server = new Websocket.Server({ port });
  server.on('connection', function connect(ws, req) {
    ws.on('message', (msg) => {
      const msgId = JSON.parse(msg).messageId;
      if (msgId === MSG_ERROR) {
        ws.close();
      } else if (msgId === MSG_TEST) {
        ws.send(Buffer.from(JSON.stringify(message)).toString('utf8'));
      } else if (msgId === MSG_PING) {
        ws.ping(MSG_PING);
      } else {
        ws.send(msgId);
      }
    });

    ws.on('ping', () => {
      ws.pong();
    });
  });
  return server;
}

function buildWebsocket(url = wsUrl) {
  const ws = new TuyaWebsocket({
    timeout: 1000,
    maxRetryTimes: 3,
    retryTimeout: 300,
    url,
    accessKey,
    accessId,
    env: TuyaWebsocket.env.PROD,
  });
  return ws;
}

let server;
beforeAll((done) => {
  server = buildWebsocketServer();
  server.on('listening', () => {
    done();
  });
});

afterAll((done) => {
  server &&
    server.close(() => {
      done();
    });
});

describe('客户端测试', () => {
  test('客户端连接测试', async () => {
    const ws = buildWebsocket();
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(false);
      }, 1000);
      ws.open(() => {
        resolve(true);
      });
      ws.start();
    });
    expect(result).toBe(true);
  });

  test('客户端 pong 响应测试', async () => {
    const ws = buildWebsocket();
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(false);
      }, 2000);
      ws.pong(() => {
        resolve(true);
      });
      ws.start();
    });
    expect(result).toBe(true);
  });

  test('客户端 ping 响应测试', async () => {
    const ws = buildWebsocket();
    const result = await new Promise((resolve, reject) => {
      ws.open(() => {
        ws.ackMessage(MSG_PING);
      });

      ws.ping(() => {
        resolve(true);
      });

      ws.pong(() => {
        resolve(false);
      });

      ws.close(() => {
        resolve(false);
      });

      ws.error((w, err) => {
        resolve(false);
      });

      ws.start();
    });

    expect(result).toEqual(true);
  });

  test('客户端接收消息测试', async () => {
    const ws = buildWebsocket();
    const result = await new Promise((resolve, reject) => {
      ws.open(() => {
        ws.ackMessage(MSG_TEST);
      });

      ws.message((w, data) => {
        resolve(data);
      });

      ws.error(() => {
        resolve(false);
      });

      ws.close(() => {
        resolve(false);
      });

      ws.start();
    });
    expect(result).toEqual(decryptMessage);
  });

  test('客户端测试重新链接', async () => {
    const ws = buildWebsocket('http://localhost:8000/');
    await new Promise((resolve, reject) => {
      let timer;
      ws.open(() => {
        ws.ackMessage(MSG_ERROR);
      });

      ws.reconnect(() => {
        clearTimeout(timer);
      });

      ws.close(() => {
        timer = setTimeout(() => {
          clearTimeout(timer);
          resolve();
        }, 1000);
      });
      ws.start();
    });
    expect(ws.retryTimes).toEqual(3);
  });
});
