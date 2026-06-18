const { safeWait, dismissCookieBanner } = require('./pageUtils');
const { SEL, readNavProfile } = require('./dmDom');
const accountsRepo = require('../db/repositories/accounts');
const logger = require('../logger');

async function readProfileFromDom(page) {
  const navProfile = await readNavProfile(page);
  if (navProfile?.username) {
    return navProfile;
  }

  return page.evaluate(() => {
    const title = document.querySelector('[data-e2e="user-title"]')?.textContent?.trim();
    let subtitle = document.querySelector('[data-e2e="user-subtitle"]')?.textContent?.trim();
    if (subtitle) subtitle = subtitle.replace(/^@/, '');

    if (title || subtitle) {
      return {
        displayName: title || subtitle,
        username: subtitle || null,
      };
    }

    const profileLink = document.querySelector('a[data-e2e="nav-profile"][href*="/@"]');
    const href = profileLink?.getAttribute('href') || '';
    const match = href.match(/@([^/?#]+)/);
    return match ? { username: match[1], displayName: null } : null;
  });
}

async function openProfilePage(page) {
  let profile = await readProfileFromDom(page);
  if (profile?.displayName && profile?.username) return profile;

  const profileUrl = profile?.username
    ? `https://www.tiktok.com/@${profile.username}`
    : 'https://www.tiktok.com/profile';

  await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);
  await safeWait(page, 2000);

  profile = await readProfileFromDom(page);
  const urlMatch = page.url().match(/@([^/?#]+)/);
  if (!profile?.username && urlMatch) {
    profile = { username: urlMatch[1], displayName: profile?.displayName || null };
  }

  if (profile?.username && !profile?.displayName) {
    await safeWait(page, 800);
    const refreshed = await readProfileFromDom(page);
    if (refreshed?.displayName) {
      profile.displayName = refreshed.displayName;
    }
  }

  return profile?.username ? profile : null;
}

async function parseProfile(page) {
  return openProfilePage(page);
}

async function syncAccountProfile(page, accountId, options = {}) {
  const returnToMessages = options.returnToMessages !== false;
  const returnUrl = page.url();

  const profile = await openProfilePage(page);
  if (profile?.username) {
    accountsRepo.setProfile(accountId, {
      tiktokUsername: profile.username,
      displayName: profile.displayName || profile.username,
    });
    logger.info(
      `Account profile synced: @${profile.username} (${profile.displayName || profile.username})`
    );
  }

  if (returnToMessages && returnUrl.includes('/messages') && !page.url().includes('/messages')) {
    await page.goto('https://www.tiktok.com/messages', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await safeWait(page, 1500);
  }

  return profile;
}

module.exports = { parseProfile, syncAccountProfile, readProfileFromDom, SEL };
