const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { config, ROOT } = require('../config');
const { notify } = require('../bot');
const logger = require('../logger');

let intervalId = null;
let updating = false;

const DEFAULT_REPO = 'https://github.com/romanich237/tiktok-mod.git';

function isGitRepo() {
  return fs.existsSync(path.join(ROOT, '.git'));
}

function runGit(cmd) {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/bash',
    }).trim();
  } catch (err) {
    const details = [err.stderr, err.stdout, err.message].filter(Boolean).join(' ').trim();
    throw new Error(details || `git command failed: ${cmd}`);
  }
}

function getUpdaterConfig() {
  return {
    enabled: config.updater?.enabled !== false,
    branch: config.updater?.branch || 'main',
    repository: config.updater?.repository || DEFAULT_REPO,
    intervalMinutes: config.updater?.checkIntervalMinutes || 1,
  };
}

function ensureGitRemote(repo, branch) {
  try {
    runGit('git remote get-url origin');
  } catch {
    runGit(`git remote add origin ${repo}`);
  }

  try {
    const url = runGit('git remote get-url origin');
    if (url !== repo && !url.includes('romanich237/tiktok-mod')) {
      runGit(`git remote set-url origin ${repo}`);
    }
  } catch {
    // ignore
  }

  runGit(`git fetch origin ${branch} --prune`);

  try {
    runGit(`git rev-parse --verify ${branch}`);
  } catch {
    runGit(`git checkout -b ${branch}`);
  }

  runGit(`git branch -M ${branch}`);
  try {
    runGit(`git branch --set-upstream-to=origin/${branch} ${branch}`);
  } catch {
    // branch may already track origin
  }
}

function getLocalHash() {
  return runGit('git rev-parse HEAD');
}

function getRemoteHash(branch) {
  return runGit(`git rev-parse origin/${branch}`);
}

function schedulePm2Restart() {
  logger.info('Scheduling PM2 restart after update...');
  const child = spawn(
    'bash',
    ['-c', 'sleep 2 && pm2 restart ecosystem.config.js --update-env && pm2 save'],
    {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore',
    }
  );
  child.unref();
  setTimeout(() => process.exit(0), 1500);
}

async function applyUpdate(branch, repo) {
  if (updating) return;
  updating = true;

  try {
    await notify('Вышла новая версия проекта, перезапускаю сервер');

    ensureGitRemote(repo, branch);

    logger.info(`Updating: origin/${branch}`);
    runGit(`git fetch origin ${branch}`);
    runGit(`git reset --hard origin/${branch}`);

    logger.info('Installing dependencies...');
    execSync('npm install', { cwd: ROOT, stdio: 'inherit', shell: '/bin/bash' });

    logger.info('Update applied, restarting PM2...');
    schedulePm2Restart();
  } catch (err) {
    logger.error('Auto-update failed', err);
    await notify(`❌ Ошибка обновления: ${err.message}`);
    updating = false;
  }
}

async function checkForUpdates() {
  const { enabled, branch, repository } = getUpdaterConfig();
  if (!enabled || updating) return;

  if (!isGitRepo()) {
    logger.warn('Auto-updater: .git not found — run install.sh or git clone');
    return;
  }

  try {
    ensureGitRemote(repository, branch);

    const local = getLocalHash();
    const remote = getRemoteHash(branch);

    if (local !== remote) {
      logger.info(`Update available: ${local.slice(0, 7)} -> ${remote.slice(0, 7)}`);
      await applyUpdate(branch, repository);
    }
  } catch (err) {
    logger.error(`Update check failed: ${err.message}`);
  }
}

function initAutoUpdater() {
  const { enabled, branch, repository, intervalMinutes } = getUpdaterConfig();

  if (!enabled) {
    logger.info('Auto-updater disabled');
    return;
  }

  if (!isGitRepo()) {
    logger.warn('Auto-updater: not a git repository — updates from GitHub will not work');
    return;
  }

  const ms = intervalMinutes * 60 * 1000;
  logger.info(
    `Auto-updater enabled (every ${intervalMinutes} min, ${repository}, branch: ${branch})`
  );

  checkForUpdates().catch((err) => logger.error('Initial update check failed', err));
  intervalId = setInterval(() => {
    checkForUpdates().catch((err) => logger.error('Update check failed', err));
  }, ms);
}

function stopAutoUpdater() {
  if (intervalId) clearInterval(intervalId);
}

module.exports = { initAutoUpdater, stopAutoUpdater, checkForUpdates, ensureGitRemote };
