/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { MD5, AES, enc, mode, pad } from 'crypto-js';
const crypto = require('crypto');

export function getTopicUrl(websocketUrl: string, accessId: string, env: string, query: string) {
  return `${websocketUrl}ws/v2/consumer/persistent/${accessId}/out/${env}/${accessId}-sub${query}`;
}

export function buildQuery(query: { [key: string]: number | string }) {
  return Object.keys(query)
    .map((key) => `${key}=${encodeURIComponent(query[key])}`)
    .join('&');
}

export function buildPassword(accessId: string, accessKey: string) {
  const key = MD5(accessKey).toString();
  return MD5(`${accessId}${key}`).toString().substr(8, 16);
}

export function decrypt(data: string, accessKey: string, encryptyModel: string) {
  if (encryptyModel === 'aes_gcm') {
    return decryptByGCM(data, accessKey);
  } else {
    return decryptByECB(data, accessKey);
  }
}

export function decryptByECB(data: string, accessKey: string) {
  try {
    const realKey = enc.Utf8.parse(accessKey.substring(8, 24));
    const json = AES.decrypt(data, realKey, {
      mode: mode.ECB,
      padding: pad.Pkcs7,
    });
    const dataStr = enc.Utf8.stringify(json).toString();
    return JSON.parse(dataStr);
  } catch (e) {
    return '';
  }
}

export function decryptByGCM(data: string, accessKey: string) {
  try {
    var bData = Buffer.from(data, 'base64');
    const iv = bData.slice(0, 12);
    const tag = bData.slice(-16);
    const cdata = bData.slice(12, bData.length - 16);
    const decipher = crypto.createDecipheriv('aes-128-gcm', accessKey.substring(8, 24), iv);
    decipher.setAuthTag(tag);
    var dataStr = decipher.update(cdata);
    dataStr += decipher.final('utf8');
    return JSON.parse(dataStr);
  } catch (e) {
    return '';
  }
}

export function encrypt(data: any, accessKey: string) {
  try {
    const realKey = enc.Utf8.parse(accessKey.substring(8, 24));
    const realData = JSON.stringify(data);
    const retData = AES.encrypt(realData, realKey, {
      mode: mode.ECB,
      padding: pad.Pkcs7,
    }).toString();
    return retData;
  } catch (e) {
    return '';
  }
}
