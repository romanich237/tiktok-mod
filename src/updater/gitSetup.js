const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_REPO = 'https://github.com/romanich237/tiktok-mod.git';
const DEFAULT_BRANCH = 'main';

function runGit(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });

  if (result.status !== 0) {
    const details = [result.stderr, result.stdout].filter(Boolean).join(' ').trim();
    throw new Error(details || `git ${args.join(' ')} failed`);
  }

  return (result.stdout || '').trim();
}

function isGitRepo(root) {
  return fs.existsSync(path.join(root, '.git'));
}

function hasGitCommand() {
  const result = spawnSync('git', ['--version'], { encoding: 'utf8', stdio: 'pipe' });
  return result.status === 0;
}

function ensureOriginRemote(root, repo) {
  try {
    const url = runGit(root, ['remote', 'get-url', 'origin']);
    if (url !== repo && !url.includes('romanich237/tiktok-mod')) {
      runGit(root, ['remote', 'set-url', 'origin', repo]);
    }
  } catch {
    runGit(root, ['remote', 'add', 'origin', repo]);
  }
}

function bootstrapGitRepo(root, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH) {
  if (!hasGitCommand()) {
    throw new Error('git не установлен на сервере');
  }

  if (isGitRepo(root)) {
    ensureOriginRemote(root, repo);
    return false;
  }

  runGit(root, ['init']);
  ensureOriginRemote(root, repo);
  runGit(root, ['fetch', 'origin', branch, '--prune']);
  runGit(root, ['checkout', '-B', branch, `origin/${branch}`]);
  runGit(root, ['reset', '--hard', `origin/${branch}`]);
  return true;
}

function fetchOrigin(root, branch = DEFAULT_BRANCH) {
  runGit(root, ['fetch', 'origin', branch, '--prune']);
}

function ensureOnBranch(root, branch = DEFAULT_BRANCH) {
  fetchOrigin(root, branch);

  try {
    const current = runGit(root, ['symbolic-ref', '--short', 'HEAD']);
    if (current === branch) return;
  } catch {
    // detached HEAD or unborn branch
  }

  runGit(root, ['checkout', '-B', branch, `origin/${branch}`]);
}

function getRevisionState(root, branch = DEFAULT_BRANCH) {
  ensureOriginRemote(root, DEFAULT_REPO);
  fetchOrigin(root, branch);
  ensureOnBranch(root, branch);

  const local = runGit(root, ['rev-parse', 'HEAD']);
  const remote = runGit(root, ['rev-parse', `origin/${branch}`]);

  return {
    branch,
    local,
    remote,
    localShort: local.slice(0, 7),
    remoteShort: remote.slice(0, 7),
    behind: local !== remote,
  };
}

function hardResetToOrigin(root, branch = DEFAULT_BRANCH) {
  fetchOrigin(root, branch);
  ensureOnBranch(root, branch);
  runGit(root, ['reset', '--hard', `origin/${branch}`]);
}

module.exports = {
  DEFAULT_REPO,
  DEFAULT_BRANCH,
  runGit,
  isGitRepo,
  hasGitCommand,
  bootstrapGitRepo,
  ensureOriginRemote,
  fetchOrigin,
  ensureOnBranch,
  getRevisionState,
  hardResetToOrigin,
};
