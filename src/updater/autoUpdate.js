const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { config, ROOT } = require('../config');
const { notify } = require('../bot');
const logger = require('../logger');

let intervalId = null;
let updating = false;

function isGitRepo() {
  return fs.existsSync(path.join(ROOT, '.git'));
}

function runGit(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function getLocalHash() {
  return runGit('git rev-parse HEAD');
}

function getRemoteHash(branch) {
  return runGit(`git rev-parse origin/${branch}`);
}

async function applyUpdate(branch) {
  if (updating) return;
  updating = true;

  try {
    await notify('Вышла новую версия проекта, перезапускаю сервер');

    logger.info('Pulling updates from GitHub...');
    runGit(`git pull origin ${branch}`);

    logger.info('Installing dependencies...');
    execSync('npm install', { cwd: ROOT, stdio: 'inherit' });

    logger.info('Restarting application...');
    execSync('pm2 restart ecosystem.config.js', { cwd: ROOT, stdio: 'inherit' });
  } catch (err) {
    logger.error('Auto-update failed', err);
    await notify(`❌ Ошибка обновления: ${err.message}`);
    updating = false;
  }
}

async function checkForUpdates() {
  if (!config.updater?.enabled || updating) return;
  if (!isGitRepo()) return;

  const branch = config.updater.branch || 'main';
  const repo = config.updater.repository;

  try {
    if (repo) {
      try {
        runGit(`git remote get-url origin`);
      } catch {
        runGit(`git remote add origin ${repo}`);
      }
    }

    runGit('git fetch origin --quiet');

    const local = getLocalHash();
    const remote = getRemoteHash(branch);

    if (local !== remote) {
      logger.info(`Update available: ${local.slice(0, 7)} -> ${remote.slice(0, 7)}`);
      await applyUpdate(branch);
    }
  } catch (err) {
    logger.error('Update check failed', err);
  }
}

function initAutoUpdater() {
  if (!config.updater?.enabled) {
    logger.info('Auto-updater disabled');
    return;
  }

  if (!isGitRepo()) {
    logger.warn('Auto-updater: not a git repository, skipping');
    return;
  }

  const minutes = config.updater.checkIntervalMinutes || 1;
  const ms = minutes * 60 * 1000;

  logger.info(`Auto-updater enabled (every ${minutes} min, branch: ${config.updater.branch || 'main'})`);

  checkForUpdates().catch((err) => logger.error('Initial update check failed', err));
  intervalId = setInterval(() => {
    checkForUpdates().catch((err) => logger.error('Update check failed', err));
  }, ms);
}

function stopAutoUpdater() {
  if (intervalId) clearInterval(intervalId);
}

module.exports = { initAutoUpdater, stopAutoUpdater, checkForUpdates };
