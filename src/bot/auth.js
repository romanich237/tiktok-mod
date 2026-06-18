const { config } = require('../config');
const accountsRepo = require('../db/repositories/accounts');
const browserManager = require('../automation/browser');
const { loginMethodsKeyboard } = require('./keyboards/inline');

function authKeyboard() {
  return loginMethodsKeyboard();
}

function isAccountAuthorized() {
  const accountId = config.tiktok?.accountId || 'default';
  const hasStorage = browserManager.storageExists(accountId);

  if (hasStorage) {
    const account = accountsRepo.getAccount(accountId);
    if (!account?.is_logged_in) {
      accountsRepo.setLoggedIn(accountId, true);
    }
    return true;
  }

  const account = accountsRepo.getAccount(accountId);
  return Boolean(account?.is_logged_in);
}

module.exports = { isAccountAuthorized, authKeyboard };
