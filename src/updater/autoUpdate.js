const { execSync, spawnSync } = require('child_process');
const { config, ROOT } = require('../config');
const { notify } = require('../bot');
const logger = require('../logger');
const {
  DEFAULT_REPO,
  DEFAULT_BRANCH,
  hasGitCommand,
  isGitRepo,
  bootstrapGitRepo,
  getRevisionState,
  hardResetToOrigin,
} = require('./gitSetup');

let intervalId = null;
let updating = false;
let lastCheckAt = null;
let lastCheckError = null;
let lastKnownLocal = null;
let lastKnownRemote = null;
let bootstrapAttempted = false;

function getUpdaterConfig() {
  return {
    enabled: config.updater?.enabled !== false,
    branch: config.updater?.branch || DEFAULT_BRANCH,
    repository: config.updater?.repository || DEFAULT_REPO,
    intervalMinutes: config.updater?.checkIntervalMinutes || 1,
  };
}

function restartProcess() {
  logger.info('Update applied — restarting process (PM2 autorestart)...');
  setTimeout(() => process.exit(0), 800);
}

async function applyUpdate(branch) {
  if (updating) return;
  updating = true;

  try {
    await notify('Вышла новая версия проекта, перезапускаю сервер');

    logger.info(`Updating to origin/${branch}...`);
    hardResetToOrigin(ROOT, branch);

    logger.info('Installing dependencies...');
    execSync('npm install', {
      cwd: ROOT,
      stdio: 'inherit',
    });

    logger.info('Update applied successfully');
    restartProcess();
  } catch (err) {
    logger.error('Auto-update failed', err);
    await notify(`❌ Ошибка обновления: ${err.message}`);
    updating = false;
  }
}

function ensureGitReady(repository, branch) {
  if (!hasGitCommand()) {
    throw new Error('git не установлен (sudo apt install git)');
  }

  if (!isGitRepo(ROOT) && !bootstrapAttempted) {
    bootstrapAttempted = true;
    logger.info('Auto-updater: initializing git in project folder...');
    bootstrapGitRepo(ROOT, repository, branch);
    logger.info('Auto-updater: git initialized');
  }

  if (!isGitRepo(ROOT)) {
    throw new Error('нет папки .git — переустановите через git clone или ./install.sh');
  }

  bootstrapGitRepo(ROOT, repository, branch);
}

async function checkForUpdates() {
  const { enabled, branch, repository } = getUpdaterConfig();
  if (!enabled || updating) return;

  lastCheckAt = new Date().toISOString();

  try {
    ensureGitReady(repository, branch);

    const state = getRevisionState(ROOT, branch);
    lastKnownLocal = state.localShort;
    lastKnownRemote = state.remoteShort;
    lastCheckError = null;

    logger.info(
      `Update check: local=${state.localShort} remote=${state.remoteShort} behind=${state.behind}`
    );

    if (state.behind) {
      logger.info(`Update available: ${state.localShort} -> ${state.remoteShort}`);
      await applyUpdate(branch);
    }
  } catch (err) {
    lastCheckError = err.message;
    logger.error(`Update check failed: ${err.message}`);
  }
}

function getUpdaterStatus() {
  const { enabled, branch, repository, intervalMinutes } = getUpdaterConfig();
  return {
    enabled,
    branch,
    repository,
    intervalMinutes,
    gitReady: isGitRepo(ROOT) && hasGitCommand(),
    hasGit: hasGitCommand(),
    local: lastKnownLocal,
    remote: lastKnownRemote,
    lastCheckAt,
    lastError: lastCheckError,
    updating,
  };
}

function initAutoUpdater() {
  const { enabled, branch, repository, intervalMinutes } = getUpdaterConfig();

  if (!enabled) {
    logger.info('Auto-updater disabled in config');
    return;
  }

  if (!hasGitCommand()) {
    logger.warn('Auto-updater: git command not found');
    return;
  }

  const ms = intervalMinutes * 60 * 1000;
  logger.info(
    `Auto-updater enabled (every ${intervalMinutes} min, ${repository}, branch: ${branch})`
  );

  checkForUpdates()
    .then(() => {
      const status = getUpdaterStatus();
      if (status.lastError) {
        notify(`⚠️ Автообновление: ${status.lastError}`).catch(() => {});
      }
    })
    .catch((err) => logger.error('Initial update check failed', err));

  intervalId = setInterval(() => {
    checkForUpdates().catch((err) => logger.error('Update check failed', err));
  }, ms);
}

function stopAutoUpdater() {
  if (intervalId) clearInterval(intervalId);
}

module.exports = {
  initAutoUpdater,
  stopAutoUpdater,
  checkForUpdates,
  getUpdaterStatus,
};
