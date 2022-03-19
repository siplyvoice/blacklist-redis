#!/usr/bin/env node
const assert = require('assert');
const { createClient } = require('redis');
const bent = require('bent');
const mysql = require('mysql2');
const cidrRange = require('cidr-range');
let client;

const connection = mysql.createConnection({
  host: process.env.SIPLY_MYSQL_HOST || '127.0.0.1',
  user:  process.env.SIPLY_MYSQL_USER || 'siply',
  database: process.env.SIPLY_MYSQL_DATABASE || 'siply',
  password:  process.env.SIPLY_MYSQL_PASSWORD || 'siply'
});

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/* validate environment */
const {
  APIBAN_API_KEY,
  APIBAN_REDIS_SERVER,
  APIBAN_REDIS_PORT = 6379,
  APIBAN_REDIS_KEY,
} = process.env;
assert.ok(APIBAN_REDIS_SERVER, 'env APIBAN_REDIS_SERVER is required');
assert.ok(APIBAN_REDIS_KEY, 'env APIBAN_REDIS_KEY is required');
assert.ok(APIBAN_API_KEY, 'env APIBAN_API_KEY is required');

const connectRedis = async() => {
  return new Promise((resolve, reject) => {
    client = createClient({
      url: `redis://${APIBAN_REDIS_SERVER}:${APIBAN_REDIS_PORT}`
    });
    client
      .on('error', (err) => {
        console.log('failed connecting to redis', err);
        reject(err);
      })
      .on('ready', resolve);
    client.connect();
  });
};

const getAPIBAN = async() => {
  let id;
  let ips = [];
  const get = bent('https://apiban.org', 'GET', 'json', 200);
  do {
    try {
      const url = `/api/${APIBAN_API_KEY}/banned${id ? ('/' + id) : ''}`;
      const response = await get(url);
      ips = [...ips, ...response.ipaddress];
      id = response.ID;
      console.log(`fetched ${response.ipaddress.length} ips from APIBAN, next ID ${id}`);
      await sleep(3000);
    } catch (err) {
      if (ips.length) return ips;
      console.error('Failed to get blacklist from apiban', err);
      throw err;
    }
  } while (id && id !== 'none');
  return ips;
};

const getVoIPBL = async(ips) => {
  try {
    const get = bent('http://www.voipbl.org/update', 'GET', 'string', 200);
    const voipblacklist = [];
    const voipblresponse = await get('/');
    console.log(voipblresponse);
    voipblresponse.split('\n')
      .map((cidr) => {
        if (cidr) {
          if (cidr.indexOf('#') !== -1) {
            return;
          }
          voipblacklist.push(...cidrRange(cidr));
        }
      });
    console.log(`fetched ${voipblacklist.length} ips from VoIPBL`);
    ips = [...ips, ...voipblacklist];

  } catch (err) {
    if (ips.length) return ips;
    console.error('Failed to get blacklist from VoIPBL', err);
    throw err;
  }
  return ips;
};


const updateRedis = async(ips) => {
  try {
    await client.DEL(APIBAN_REDIS_KEY);
    await client.sendCommand(['SADD', APIBAN_REDIS_KEY, ...ips]);
    console.log();
    console.log(`Success! the redis set named ${APIBAN_REDIS_KEY} now contains ${ips.length} ips`);
  } catch (err) {
    console.log(err);
  }
};

const updateKamailio = async(ips) => {
  try {
    connection.query('DELETE FROM secfilter WHERE type = 3', function(err) {
      const sqlArray = ips.map((ip) => [0, 3, ip]);
      connection.query('INSERT INTO secfilter (action, type, data) VALUES ?', [sqlArray], true, function(err, result) {
        const affectedRows = result ? result.affectedRows : 0;
        console.log(affectedRows);
      });
    });
    return ips;
  } catch (err) {
    if (ips.length) return ips;
    console.log(err);
  }
};

connectRedis()
  .then(getAPIBAN)
  .then(getVoIPBL)
  .then(updateKamailio)
  .then(updateRedis)
  .then(process.exit)
  .catch((err) => {
    console.error(err);
    process.exit(0);
  });

