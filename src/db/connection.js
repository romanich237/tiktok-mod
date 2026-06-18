const mysql = require('mysql2/promise');
const { env } = require('../config');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.mysql.host,
      port: env.mysql.port,
      user: env.mysql.user,
      password: env.mysql.password,
      database: env.mysql.database,
      waitForConnections: true,
      connectionLimit: 10,
      timezone: '+00:00',
    });
  }
  return pool;
}

module.exports = { getPool };
