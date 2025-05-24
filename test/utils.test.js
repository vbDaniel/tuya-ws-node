/* eslint-disable no-undef */
const TuyaWebsocket = require('../src').default;
const { getTopicUrl, buildQuery, buildPassword, decrypt, encrypt } = require('../src/utils');
const { TUYA_PASULAR_ENV, getTuyaEnvConfig, TuyaEnvConfig } = require('../src/config');
const { accessKey, accessId, originData, encryptCode } = require('./const');

const query = { subscriptionType: 'Failover', ackTimeoutMillis: 30000 };

describe('消息订阅工具方法测试', () => {
  test('buildQuery 构建 URL query 字符串测试', () => {
    const queryStr = buildQuery(query);
    const returnQueryStr = Object.keys(query)
      .map((key) => `${key}=${encodeURIComponent(query[key])}`)
      .join('&');
    expect(queryStr).toEqual(returnQueryStr);
  });

  test('getTuyaEnvConfig 获取环境配置测试', () => {
    const env = getTuyaEnvConfig(TUYA_PASULAR_ENV.PROD);
    const returnEnv = TuyaEnvConfig.prod;
    expect(env).toEqual(returnEnv);
  });

  test('getTopicUrl 获取订阅 topic URL 测试', () => {
    const url = getTopicUrl(TuyaWebsocket.URL.CN, accessId, TuyaWebsocket.env.PROD, `?${buildQuery(query)}`);
    const returnUrl = `${TuyaWebsocket.URL.CN}ws/v2/consumer/persistent/${accessId}/out/${
      TuyaWebsocket.env.PROD
    }/${accessId}-sub?${buildQuery(query)}`;
    expect(url).toEqual(returnUrl);
  });

  test('decrypt 解密测试', () => {
    const obj = decrypt(encryptCode, accessKey);
    expect(obj).toEqual(originData);
  });

  test('encrypt 加密测试', () => {
    const retData = encrypt(originData, accessKey);
    expect(retData).toEqual(encryptCode);
  });

  test('buildPassword 构建密码测试', () => {
    const pwd = buildPassword(accessId, accessKey);
    const returnPwd = 'ad0139f768d194a4';
    expect(pwd).toEqual(returnPwd);
  });
});
