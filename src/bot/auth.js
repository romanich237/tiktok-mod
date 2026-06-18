const { config } = require('../config');
const accountsRepo = require('../db/repositories/accounts');
const browserManager = require('../automation/browser');

function isAccountAuthorized() {
  const accountId = config.tiktok?.accountId || 'default';
  const account = accountsRepo.getAccount(accountId);
  return Boolean(account?.is_logged_in) || browserManager.storageExists(accountId);
}

module.exports = { isAccountAuthorized };
