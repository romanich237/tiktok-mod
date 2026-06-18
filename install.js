#!/usr/bin/env node

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const net = require('net');
const os = require('os');

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'config.json');
const EXAMPLE_PATH = path.join(ROOT, 'config.json.example');
const MYSQL_WAIT_SEC = 90;
const MYSQL_PORT_MIN = 2000;
const MYSQL_PORT_MAX = 3000;
const MYSQL_DATA_DIR = path.join(ROOT, 'mysql-data');
const MYSQL_CONF_PATH = path.join(ROOT, 'deploy', 'mysql-local.cnf');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(msg) {
  console.log(`${colors.cyan}[tiktok-mod]${colors.reset} ${msg}`);
}

function ok(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function warn(msg) {
  console.log(`${colors.yellow}!${colors.reset} ${msg}`);
}

function fail(msg) {
  console.error(`${colors.red}✗${colors.reset} ${msg}`);
  process.exit(1);
}

function ensureSupportedDistro() {
  if (os.platform() !== 'linux') {
    fail('TikTok Mod поддерживает только Ubuntu и Debian');
  }

  try {
    const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
    const id = (osRelease.match(/^ID=(.+)$/m)?.[1] || '').replace(/"/g, '').toLowerCase();
    const idLike = (osRelease.match(/^ID_LIKE=(.+)$/m)?.[1] || '').replace(/"/g, '').toLowerCase();
    const supported =
      id === 'ubuntu' ||
      id === 'debian' ||
      idLike.includes('debian') ||
      idLike.includes('ubuntu');

    if (!supported) {
      fail(`Дистрибутив "${id || 'unknown'}" не поддерживается. Используйте Ubuntu или Debian.`);
    }
    ok(`Дистрибутив: ${id}`);
  } catch {
    warn('Не удалось прочитать /etc/os-release — убедитесь, что это Ubuntu или Debian');
  }
}

function run(cmd, options = {}) {
  log(`> ${cmd}`);
  execSync(cmd, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: '/bin/bash',
    ...options,
  });
}

function runOptional(cmd, options = {}) {
  try {
    run(cmd, options);
    return true;
  } catch {
    return false;
  }
}

function commandExists(name) {
  try {
    execSync(`command -v ${name}`, { stdio: 'ignore', shell: '/bin/bash' });
    return true;
  } catch {
    return false;
  }
}

function getNodeMajor() {
  return Number(process.versions.node.split('.')[0]);
}

function ask(question, { hidden = false } = {}) {
  if (hidden && process.stdin.isTTY) {
    process.stdout.write(question);
    return new Promise((resolve) => {
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      let value = '';
      const onData = (ch) => {
        if (ch === '\n' || ch === '\r' || ch === '\u0004') {
          stdin.setRawMode(wasRaw);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value.trim());
          return;
        }
        if (ch === '\u0003') process.exit(1);
        if (ch === '\u007f') {
          value = value.slice(0, -1);
          return;
        }
        value += ch;
      };
      stdin.on('data', onData);
    });
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = MYSQL_WAIT_SEC * 1000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ port, host }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`MySQL недоступен на ${host}:${port}`));
          return;
        }
        setTimeout(tryConnect, 2000);
      });
    };
    tryConnect();
  });
}

function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findFreePort(min = MYSQL_PORT_MIN, max = MYSQL_PORT_MAX) {
  for (let port = min; port <= max; port++) {
    if (await isPortFree(port)) return port;
  }
  fail(`Нет свободного порта MySQL в диапазоне ${min}-${max}`);
}

function isPortInRange(port) {
  return port >= MYSQL_PORT_MIN && port <= MYSQL_PORT_MAX;
}

function loadConfigFile() {
  if (!fs.existsSync(CONFIG_PATH)) {
    if (!fs.existsSync(EXAMPLE_PATH)) {
      fail('Файл config.json.example не найден');
    }
    fs.copyFileSync(EXAMPLE_PATH, CONFIG_PATH);
    ok('Создан config.json из шаблона');
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfigFile(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function getMysqlSettings(config) {
  const mysql = config.mysql || {};
  const port = Number(mysql.port);
  return {
    host: mysql.host || 'localhost',
    port: port > 0 ? port : MYSQL_PORT_MIN,
    user: mysql.user || 'tiktok',
    password: mysql.password || 'tiktokpass',
    database: mysql.database || 'tiktok_mod',
  };
}

function updateTelegramConfig(config, botToken, userId) {
  config.telegram = config.telegram || {};
  if (botToken) config.telegram.botToken = botToken;
  if (userId) config.telegram.allowedUserIds = [Number(userId)];
  return config;
}

function ensureDirs() {
  for (const dir of ['sessions', 'logs', 'mysql-data', 'deploy']) {
    fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    useSystemd: args.includes('--systemd'),
    nonInteractive: args.includes('--yes') || args.includes('-y'),
    botToken: getArgValue(args, '--token'),
    userId: getArgValue(args, '--user-id'),
  };
}

function getArgValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] || null;
}

async function promptConfig(options) {
  let config = loadConfigFile();
  const hasToken =
    config.telegram?.botToken && config.telegram.botToken !== 'your_bot_token_here';
  const hasUserId =
    Array.isArray(config.telegram?.allowedUserIds) &&
    config.telegram.allowedUserIds.length &&
    config.telegram.allowedUserIds[0] !== 123456789;

  if (!options.nonInteractive) {
    console.log('');
    log('Настройка Telegram');
    if (!options.botToken && !hasToken) {
      options.botToken = await ask('Токен бота от @BotFather: ');
    }
    if (!options.userId && !hasUserId) {
      options.userId = await ask('Ваш Telegram ID (@userinfobot): ');
    }
  }

  config = updateTelegramConfig(config, options.botToken, options.userId);
  saveConfigFile(config);

  if ((options.botToken && options.userId) || (hasToken && hasUserId)) {
    ok('config.json обновлён');
  } else if (!hasToken || !hasUserId) {
    warn('Заполните telegram.botToken и telegram.allowedUserIds в config.json перед запуском');
  }

  return config;
}

async function canConnectAsAppUser(mysqlConfig) {
  const mysql = require('mysql2/promise');
  try {
    const conn = await mysql.createConnection({
      host: mysqlConfig.host,
      port: mysqlConfig.port,
      user: mysqlConfig.user,
      password: mysqlConfig.password,
      database: mysqlConfig.database,
    });
    await conn.ping();
    await conn.end();
    return true;
  } catch {
    return false;
  }
}

async function setupLocalDatabase(mysqlConfig, rootPassword) {
  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: 'root',
    password: rootPassword,
  });

  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${mysqlConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.query(`CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?`, [
    mysqlConfig.user,
    mysqlConfig.password,
  ]);
  await conn.query(`GRANT ALL PRIVILEGES ON \`${mysqlConfig.database}\`.* TO ?@'localhost'`, [
    mysqlConfig.user,
  ]);
  await conn.query('FLUSH PRIVILEGES');
  await conn.end();
}

function installSystemDependencies() {
  if (commandExists('apt-get')) {
    log('Установка системных пакетов (apt)...');
    run('sudo apt-get update -qq');
    run(
      'sudo apt-get install -y mysql-server xvfb libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 libasound2'
    );
    runOptional('sudo systemctl stop mysql');
    runOptional('sudo systemctl disable mysql');
    ok('Пакеты установлены (локальный MySQL в папке проекта)');
    return;
  }

  warn('apt не найден — установите пакеты вручную (см. README)');
}

function writeMysqlLocalConfig(port) {
  const rootPath = ROOT.replace(/\\/g, '/');
  const dataDir = `${rootPath}/mysql-data`;
  const socket = `${dataDir}/mysql.sock`;
  const content = `[mysqld]
port = ${port}
bind-address = 127.0.0.1
datadir = ${dataDir}
socket = ${socket}
pid-file = ${dataDir}/mysql.pid
skip-name-resolve
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

[client]
port = ${port}
socket = ${socket}
`;

  fs.mkdirSync(path.dirname(MYSQL_CONF_PATH), { recursive: true });
  fs.writeFileSync(MYSQL_CONF_PATH, content);
  ok(`Конфиг MySQL: deploy/mysql-local.cnf (порт ${port})`);
}

function initMysqlDataDir() {
  fs.mkdirSync(MYSQL_DATA_DIR, { recursive: true });
  run('sudo chown -R mysql:mysql mysql-data');

  if (!fs.existsSync(path.join(MYSQL_DATA_DIR, 'ibdata1'))) {
    log('Инициализация локальной MySQL в mysql-data/...');
    run(
      `sudo mysqld --initialize-insecure --datadir="${MYSQL_DATA_DIR.replace(/\\/g, '/')}" --user=mysql`
    );
    ok('Данные MySQL созданы');
  }
}

function startLocalMysqlForInstall() {
  run('chmod +x scripts/mysql-local.sh');

  if (spawnSync('pgrep', ['-f', 'mysql-local.cnf'], { stdio: 'ignore', shell: '/bin/bash' }).status === 0) {
    ok('Локальный MySQL уже запущен');
    return;
  }

  log('Запуск локального MySQL...');
  run('nohup bash scripts/mysql-local.sh >> logs/mysql-local.log 2>&1 &');
}

async function ensureLocalMysqlInstance(config) {
  config.mysql = config.mysql || {};
  const configuredPort = Number(config.mysql.port);
  const mysqlConfig = getMysqlSettings(config);

  if (configuredPort > 0 && isPortInRange(configuredPort) && (await canConnectAsAppUser(mysqlConfig))) {
    ok(`Локальный MySQL уже работает на порту ${configuredPort}`);
    return configuredPort;
  }

  let port = configuredPort;
  if (!(port > 0 && isPortInRange(port))) {
    log(`Поиск свободного порта MySQL (${MYSQL_PORT_MIN}-${MYSQL_PORT_MAX})...`);
    port = await findFreePort();
  }

  config.mysql.port = port;
  config.mysql.host = '127.0.0.1';
  saveConfigFile(config);
  ok(`Порт MySQL: ${port}`);

  writeMysqlLocalConfig(port);
  initMysqlDataDir();
  startLocalMysqlForInstall();

  return port;
}

async function ensureLocalMysql(config, options) {
  const mysqlConfig = getMysqlSettings(config);

  log(`Проверка локального MySQL (${mysqlConfig.host}:${mysqlConfig.port})...`);

  try {
    await waitForPort(mysqlConfig.port, mysqlConfig.host);
    ok(`MySQL слушает порт ${mysqlConfig.port}`);
  } catch (err) {
    fail(
      `${err.message}\n` +
        'Проверьте локальный MySQL:\n' +
        '  cat logs/mysql-local.log\n' +
        '  bash scripts/mysql-local.sh\n' +
        '  cat deploy/mysql-local.cnf'
    );
  }

  if (await canConnectAsAppUser(mysqlConfig)) {
    ok(`База "${mysqlConfig.database}" доступна`);
    return;
  }

  log('Создание базы и пользователя...');

  try {
    await setupLocalDatabase(mysqlConfig, '');
    ok(`База "${mysqlConfig.database}" и пользователь "${mysqlConfig.user}" созданы`);
  } catch (err) {
    fail(
      `Не удалось настроить MySQL: ${err.message}\n` +
        'Создайте вручную: mysql -u root -p < sql/000_create_database.sql'
    );
  }

  if (!(await canConnectAsAppUser(mysqlConfig))) {
    fail('Подключение к MySQL не удалось. Проверьте mysql.* в config.json');
  }
}

function installPlaywright() {
  log('Установка Chromium для Playwright...');
  run('npx playwright install chromium');
  try {
    run('sudo npx playwright install-deps chromium');
    ok('Chromium и системные библиотеки установлены');
  } catch {
    warn('playwright install-deps не выполнен — при ошибках браузера запустите: sudo npx playwright install-deps chromium');
    ok('Chromium установлен');
  }
}

function setupPm2() {
  if (!commandExists('pm2')) {
    log('Установка PM2...');
    run('sudo npm install -g pm2');
  }

  const hasApp = spawnSync('pm2', ['describe', 'tiktok-mod'], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: '/bin/bash',
  }).status === 0;

  if (hasApp) {
    run('pm2 restart ecosystem.config.js');
  } else {
    run('pm2 start ecosystem.config.js');
  }

  run('pm2 save');

  const user = process.env.SUDO_USER || process.env.USER || 'root';
  const home = process.env.HOME || `/home/${user}`;
  try {
    const out = execSync(`pm2 startup systemd -u ${user} --hp ${home}`, {
      encoding: 'utf8',
      cwd: ROOT,
      shell: '/bin/bash',
    });
    const startupCmd = out.match(/sudo .+/)?.[0];
    if (startupCmd) {
      run(startupCmd);
    }
  } catch {
    warn('Автозапуск PM2 после перезагрузки не настроен — выполните: pm2 startup');
  }

  ok('MySQL и бот запущены через PM2');
  console.log('  pm2 logs tiktok-mod');
  console.log('  pm2 logs tiktok-mod-mysql');
  console.log('  pm2 status');
}

function installSystemdUnit(name, templateFile, replacements = {}) {
  const servicePath = `/etc/systemd/system/${name}.service`;
  let content = fs.readFileSync(path.join(ROOT, 'deploy', templateFile), 'utf8');
  const workingDir = ROOT.replace(/\\/g, '/');
  const user = process.env.SUDO_USER || process.env.USER || 'root';

  content = content
    .replace(/User=\S+/g, `User=${user}`)
    .replace(/WorkingDirectory=\S+/g, `WorkingDirectory=${workingDir}`);

  if (replacements.nodePath) {
    content = content.replace('/usr/bin/node', replacements.nodePath);
  }

  const tmp = `/tmp/${name}.service`;
  fs.writeFileSync(tmp, content);
  run(`sudo cp ${tmp} ${servicePath}`);
}

function setupSystemd() {
  const nodePath = execSync('command -v node', { encoding: 'utf8', shell: '/bin/bash' }).trim();

  installSystemdUnit('tiktok-mod-mysql', 'tiktok-mod-mysql.service');
  installSystemdUnit('tiktok-mod', 'tiktok-mod.service', { nodePath });

  run('sudo systemctl daemon-reload');
  run('sudo systemctl enable tiktok-mod-mysql tiktok-mod');
  run('sudo systemctl restart tiktok-mod-mysql');
  run('sudo systemctl start tiktok-mod');
  ok('Сервисы systemd запущены');
  console.log('  sudo systemctl status tiktok-mod-mysql');
  console.log('  sudo systemctl status tiktok-mod');
  console.log('  sudo journalctl -u tiktok-mod -f');
}

async function main() {
  ensureSupportedDistro();
  const options = parseArgs();

  console.log('');
  log('=== TikTok Mod — установка (Ubuntu/Debian) ===');
  log('База данных: локальный MySQL в папке mysql-data/');
  console.log('');

  if (getNodeMajor() < 18) {
    fail('Требуется Node.js 18 или новее');
  }
  ok(`Node.js ${process.versions.node}`);

  ensureDirs();
  installSystemDependencies();

  log('Установка npm-зависимостей...');
  run('npm install');
  ok('Зависимости установлены');

  installPlaywright();

  const config = await promptConfig(options);
  await ensureLocalMysqlInstance(config);
  await ensureLocalMysql(config, options);

  log('Применение миграций таблиц...');
  try {
    run('npm run migrate');
    ok('Таблицы созданы');
  } catch {
    fail('Миграция не удалась. Проверьте настройки mysql в config.json');
  }

  console.log('');
  log('=== Установка завершена ===');
  console.log('');

  if (options.useSystemd) {
    setupSystemd();
  } else {
    setupPm2();
  }

  console.log('');
  log('Дальше в Telegram: /start → /login → /chats');
  console.log('');
}

main().catch((err) => {
  fail(err.message || String(err));
});
