/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import Event from 'events';
import WebSocket from 'ws';

import { TUYA_PASULAR_ENV, getTuyaEnvConfig, TuyaRegionConfigEnum } from './config';
import { getTopicUrl, buildQuery, buildPassword, decrypt } from './utils';

import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

type LoggerLevel = 'INFO' | 'ERROR';

interface IConfig {
  accessId: string;
  accessKey: string;
  env: TUYA_PASULAR_ENV;
  url: TuyaRegionConfigEnum;

  timeout?: number;
  maxRetryTimes?: number;
  retryTimeout?: number;
  logger?: (level: LoggerLevel, ...args: any) => void;
}

class TuyaMessageSubscribeWebsocket {
  static URL = TuyaRegionConfigEnum;
  static env = TUYA_PASULAR_ENV;

  static data = 'TUTA_DATA';
  static error = 'TUYA_ERROR';
  static open = 'TUYA_OPEN';
  static close = 'TUYA_CLOSE';
  static reconnect = 'TUYA_RECONNECT';
  static ping = 'TUYA_PING';
  static pong = 'TUYA_PONG';

  private config: IConfig;
  private server?: WebSocket;
  private timer: any;
  private retryTimes: number;
  private event: Event;
  private ddbClient: DynamoDBDocumentClient;

  constructor(config: IConfig) {
    this.config = Object.assign(
      {
        ackTimeoutMillis: 3000,
        subscriptionType: 'Failover',
        retryTimeout: 1000,
        maxRetryTimes: 100,
        timeout: 30000,
        logger: console.log,
      },
      config,
    );
    this.event = new Event();
    this.retryTimes = 0;

    const ddbClient = new DynamoDBClient({
      region: 'sa-east-1',
    });
    this.ddbClient = DynamoDBDocumentClient.from(ddbClient);

    // const listTablesCommand = new ListTablesCommand();
    // const tables = this.ddbClient.send(listTablesCommand);
    // console.log('DynamoDB Tables:', tables);
  }

  public start() {
    this.server = this._connect();
  }

  public open(cb: (ws: WebSocket) => void) {
    this.event.on(TuyaMessageSubscribeWebsocket.open, cb);
  }

  public message(cb: (ws: WebSocket, message: any) => void) {
    this.event.on(TuyaMessageSubscribeWebsocket.data, cb);
  }

  public ping(cb: (ws: WebSocket) => void) {
    this.event.on(TuyaMessageSubscribeWebsocket.ping, cb);
  }

  public pong(cb: (ws: WebSocket) => void) {
    this.event.on(TuyaMessageSubscribeWebsocket.pong, cb);
  }

  public reconnect(cb: (ws: WebSocket) => void) {
    this.event.on(TuyaMessageSubscribeWebsocket.reconnect, cb);
  }

  public ackMessage(messageId: string) {
    this.server && this.server.send(JSON.stringify({ messageId }));
  }

  public error(cb: (ws: WebSocket, error: any) => void) {
    this.event.on(TuyaMessageSubscribeWebsocket.error, cb);
  }

  public close(cb: (ws: WebSocket) => void) {
    this.event.on(TuyaMessageSubscribeWebsocket.close, cb);
  }

  private _reconnect() {
    if (this.config.maxRetryTimes && this.retryTimes < this.config.maxRetryTimes) {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        this.retryTimes++;
        this._connect(false);
      }, this.config.retryTimeout);
    }
  }

  private _connect(isInit = true) {
    const { accessId, accessKey, env, url } = this.config;
    const topicUrl = getTopicUrl(
      url,
      accessId,
      getTuyaEnvConfig(env).value,
      `?${buildQuery({ subscriptionType: 'Failover', ackTimeoutMillis: 30000 })}`,
    );
    const password = buildPassword(accessId, accessKey);
    this.server = new WebSocket(topicUrl, {
      rejectUnauthorized: false,
      headers: { username: accessId, password },
    });
    this.subOpen(this.server, isInit);
    this.subMessage(this.server);
    this.subPing(this.server);
    this.subPong(this.server);
    this.subError(this.server);
    this.subClose(this.server);
    return this.server;
  }

  private subOpen(server: WebSocket, isInit = true) {
    server.on('open', () => {
      if (server.readyState === server.OPEN) {
        this.retryTimes = 0;
      }
      this.keepAlive(server);
      this.event.emit(
        isInit ? TuyaMessageSubscribeWebsocket.open : TuyaMessageSubscribeWebsocket.reconnect,
        this.server,
      );
    });
  }

  private subPing(server: WebSocket) {
    server.on('ping', () => {
      this.event.emit(TuyaMessageSubscribeWebsocket.ping, this.server);
      this.keepAlive(server);
      server.pong(this.config.accessId);
    });
  }

  private subPong(server: WebSocket) {
    server.on('pong', () => {
      this.keepAlive(server);
      this.event.emit(TuyaMessageSubscribeWebsocket.pong, this.server);
    });
  }

  private subMessage(server: WebSocket) {
    server.on('message', async (data: any) => {
      try {
        this.keepAlive(server);
        const start = Date.now();
        this.logger('INFO', `receive msg, jsonMessage=${data}`);
        const obj = this.handleMessage(data);
        await this.saveToDynamoDB(obj); // Save to DynamoDB

        this.logger('INFO', 'the real message data:', obj);
        this.event.emit(TuyaMessageSubscribeWebsocket.data, this.server, obj);
        const end = Date.now();
        this.logger('INFO', `business processing cost=${end - start}`);
      } catch (e) {
        this.logger('ERROR', e);
        this.event.emit(TuyaMessageSubscribeWebsocket.error, e);
      }
    });
  }

  private subClose(server: WebSocket) {
    server.on('close', (...data) => {
      this._reconnect();
      this.clearKeepAlive();
      this.event.emit(TuyaMessageSubscribeWebsocket.close, ...data);
    });
  }

  private subError(server: WebSocket) {
    server.on('error', (e) => {
      this.event.emit(TuyaMessageSubscribeWebsocket.error, this.server, e);
    });
  }

  private clearKeepAlive() {
    clearTimeout(this.timer);
  }

  private keepAlive(server: WebSocket) {
    this.clearKeepAlive();
    this.timer = setTimeout(() => {
      server.ping(this.config.accessId);
    }, this.config.timeout);
  }

  private handleMessage(data: string) {
    const { payload, properties, ...others } = JSON.parse(data);
    const encryptyModel = properties.em;
    const pStr = Buffer.from(payload, 'base64').toString('utf-8');
    const pJson = JSON.parse(pStr);
    pJson.data = decrypt(pJson.data, this.config.accessKey, encryptyModel);
    return { payload: pJson, ...others };
  }

  private logger(level: LoggerLevel, ...info: any) {
    const realInfo = `${Date.now()} `;
    this.config.logger && this.config.logger(level, realInfo, ...info);
  }

  private async saveToDynamoDB(data: any) {
    const deviceId = data.payload.data.devId;
    const timestampTuya = data.payload.t;
    const statusArray = data.payload.data.status;

    for (const status of statusArray) {
      const params = {
        TableName: 'TuyaDeviceData',
        Item: {
          deviceId: deviceId,
          code: status.code,
          value: status.value,
          timestampTuya: timestampTuya,
          timestamp: new Date().toISOString(),
          rawMessage: data,
        },
      };

      try {
        const response = await this.ddbClient.send(new PutCommand(params));
        console.log('RESPONSE:', response);
        this.logger('INFO', `Salvo no DynamoDB: ${deviceId} ${status.code}=${status.value}`);
      } catch (error) {
        this.logger('ERROR', 'Erro ao salvar no DynamoDB:', error);
      }
    }
  }
}

export default TuyaMessageSubscribeWebsocket;
