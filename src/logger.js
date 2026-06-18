const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { ROOT } = require('./config');

const logsDir = path.join(ROOT, 'logs');
fs.mkdirSync(logsDir, { recursive: true });

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      if (stack) return `${timestamp} [${level}] ${message}\n${stack}`;
      return `${timestamp} [${level}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logsDir, 'app.log') }),
  ],
});

module.exports = logger;
