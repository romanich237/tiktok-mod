#!/usr/bin/env node

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'config.json');
const EXAMPLE_PATH = path.join(ROOT, 'config.json.example');

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

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function normalizeConfig(config) {
  if (config.mysql && !config.database) {
    config.database = { file: 'data/tiktok_mod.db' };
    delete config.mysql;
  }
  config.database = config.database || { file: 'data/tiktok_mod.db' };
  return config;
}

function loadConfigFile() {
  if (!fs.existsSync(CONFIG_PATH)) {
    if (!fs.existsSync(EXAMPLE_PATH)) {
      fail('Файл config.json.example не найден');
    }
    fs.copyFileSync(EXAMPLE_PATH, CONFIG_PATH);
    ok('Создан config.json из шаблона');
  }
  const config = normalizeConfig(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
  saveConfigFile(config);
  return config;
}

function saveConfigFile(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function updateTelegramConfig(config, botToken, userId) {
  config.telegram = config.telegram || {};
  if (botToken) config.telegram.botToken = botToken;
  if (userId) config.telegram.allowedUserIds = [Number(userId)];
  return config;
}

function ensureDirs() {
  for (const dir of ['sessions', 'logs', 'data']) {
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

  config.database = config.database || { file: 'data/tiktok_mod.db' };
  config = updateTelegramConfig(config, options.botToken, options.userId);
  saveConfigFile(config);

  if ((options.botToken && options.userId) || (hasToken && hasUserId)) {
    ok('config.json обновлён');
  } else if (!hasToken || !hasUserId) {
    warn('Заполните telegram.botToken и telegram.allowedUserIds в config.json перед запуском');
  }

  return config;
}

function installSystemDependencies() {
  if (commandExists('apt-get')) {
    log('Установка системных пакетов (apt)...');
    run('sudo apt-get update -qq');
    run(
      'sudo apt-get install -y git xvfb libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 libasound2 build-essential python3'
    );
    ok('Системные пакеты установлены');
    return;
  }

  warn('apt не найден — установите пакеты вручную (см. README)');
}

function ensureGitRepo() {
  const repo = 'https://github.com/romanich237/tiktok-mod.git';
  const branch = 'main';
  const gitDir = path.join(ROOT, '.git');

  if (!commandExists('git')) {
    warn('git не установлен — автообновление с GitHub не будет работать');
    return;
  }

  if (!fs.existsSync(gitDir)) {
    log('Инициализация git для автообновления...');
    run('git init');
    run(`git remote add origin ${repo}`);
    run(`git fetch origin ${branch}`);
    run(`git checkout -B ${branch}`);
    run(`git reset --hard origin/${branch}`);
    ok('Git настроен');
    return;
  }

  runOptional(`git remote get-url origin`) || run(`git remote add origin ${repo}`);
  runOptional(`git fetch origin ${branch}`);
  runOptional(`git branch -M ${branch}`);
  runOptional(`git branch --set-upstream-to=origin/${branch} ${branch}`);
  ok('Git готов к автообновлению');
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

  ok('Бот запущен через PM2');
  console.log('  pm2 logs tiktok-mod');
  console.log('  pm2 status');
}

function setupSystemd() {
  const servicePath = '/etc/systemd/system/tiktok-mod.service';
  const unit = fs.readFileSync(path.join(ROOT, 'deploy', 'tiktok-mod.service'), 'utf8');
  const workingDir = ROOT.replace(/\\/g, '/');
  const nodePath = execSync('command -v node', { encoding: 'utf8', shell: '/bin/bash' }).trim();
  const content = unit
    .replace(/User=\S+/g, `User=${process.env.SUDO_USER || process.env.USER || 'root'}`)
    .replace(/WorkingDirectory=\S+/g, `WorkingDirectory=${workingDir}`)
    .replace('/usr/bin/node', nodePath);

  const tmp = '/tmp/tiktok-mod.service';
  fs.writeFileSync(tmp, content);
  run(`sudo cp ${tmp} ${servicePath}`);
  run('sudo systemctl daemon-reload');
  run('sudo systemctl enable tiktok-mod');
  run('sudo systemctl restart tiktok-mod');
  ok('Сервис systemd запущен');
  console.log('  sudo systemctl status tiktok-mod');
  console.log('  sudo journalctl -u tiktok-mod -f');
}

async function main() {
  ensureSupportedDistro();
  const options = parseArgs();

  console.log('');
  log('=== TikTok Mod — установка (Ubuntu/Debian) ===');
  log('База данных: SQLite (файл data/tiktok_mod.db)');
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
  ensureGitRepo();
  await promptConfig(options);

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
