const { safeWait, dismissCookieBanner } = require('./pageUtils');
const accountsRepo = require('../db/repositories/accounts');
const logger = require('../logger');

async function readProfileFromDom(page) {
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

    const profileLinkSelectors = [
      'a[href*="/@"][data-e2e="profile-icon"]',
      '[data-e2e="nav-profile"] a[href*="/@"]',
      'a[href*="/@"][aria-label*="Profile"]',
      'a[href*="/@"][aria-label*="Профиль"]',
    ];

    for (const selector of profileLinkSelectors) {
      const href = document.querySelector(selector)?.getAttribute('href') || '';
      const match = href.match(/@([^/?#]+)/);
      if (match) return { username: match[1], displayName: null };
    }

    const ownLink = Array.from(document.querySelectorAll('a[href*="/@"]')).find((link) => {
      const href = link.getAttribute('href') || '';
      return /^\/@[^/]+\/?$/.test(href);
    });
    const match = ownLink?.getAttribute('href')?.match(/@([^/?#]+)/);
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
  await safeWait(page, 2500);

  profile = await readProfileFromDom(page);
  const urlMatch = page.url().match(/@([^/?#]+)/);
  if (!profile?.username && urlMatch) {
    profile = { username: urlMatch[1], displayName: profile?.displayName || null };
  }

  if (profile?.username && !profile?.displayName) {
    await safeWait(page, 1000);
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
    await safeWait(page, 2000);
  }

  return profile;
}

module.exports = { parseProfile, syncAccountProfile, readProfileFromDom };
