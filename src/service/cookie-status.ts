import { ConfigManager } from '../config/manager.js';
import { readCredentials } from '../credentials/index.js';
import { logger } from '../utils/logger.js';

function buildCookieHeader(cookies: Array<Record<string, any>>): string {
  return cookies
    .map((cookie) => {
      if (!cookie?.name || typeof cookie.value !== 'string') {
        return null;
      }
      return `${cookie.name}=${cookie.value}`;
    })
    .filter(Boolean)
    .join('; ');
}

async function checkSiteWithCookies(url: string, cookiesHeader: string): Promise<boolean> {
  try {
    const response = await globalThis.fetch(url, {
      headers: cookiesHeader ? { Cookie: cookiesHeader } : undefined,
      redirect: 'follow',
    });

    const finalUrl = response.url || url;
    const bodyText = await response.text();
    const lowered = bodyText.toLowerCase();

    // 检查1：URL重定向到登录页面
    if (finalUrl.includes('/login') || finalUrl.includes('/signin') || finalUrl.includes('/auth')) {
      logger.debug(`Cookie无效：URL重定向到登录页面 ${finalUrl}`);
      return false;
    }

    // 检查2：检查明确的未登录提示词（更精确的匹配）
    const loginRequiredPatterns = [
      '请先登录',
      '立即登录',
      '用户登录',
      '会员登录',
      'please login',
      'please sign in',
      'login required',
      'sign in to continue',
    ];

    const hasLoginRequired = loginRequiredPatterns.some((pattern) => lowered.includes(pattern));
    if (hasLoginRequired) {
      logger.debug(`Cookie无效：页面包含未登录提示`);
      return false;
    }

    // 检查3：HTTP状态码
    if (response.status === 401 || response.status === 403) {
      logger.debug(`Cookie无效：HTTP状态码 ${response.status}`);
      return false;
    }

    // 如果以上检查都通过，认为Cookie有效
    logger.debug(`Cookie有效：状态码 ${response.status}`);
    return response.status < 400;
  } catch (error) {
    logger.warn(
      `Cookie 校验请求失败(${url}): ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

export async function refreshCookieStatuses(configManager: ConfigManager): Promise<void> {
  const sites = configManager.getSites();
  let changed = false;

  for (const site of sites) {
    if (!site.credentialFile) {
      if (site.cookieValid) {
        configManager.updateSite(site.id, { cookieValid: false });
        changed = true;
      }
      continue;
    }

    const stored = await readCredentials(site.id);
    if (!stored) {
      configManager.updateSite(site.id, { cookieValid: false });
      changed = true;
      continue;
    }

    // 检查是否有任何凭证数据（Cookie、localStorage、sessionStorage）
    const hasCookies = Array.isArray(stored.cookies) && stored.cookies.length > 0;
    const hasLocalStorage = stored.localStorage && Object.keys(stored.localStorage).length > 0;
    const hasSessionStorage =
      stored.sessionStorage && Object.keys(stored.sessionStorage).length > 0;

    // 如果没有任何凭证数据，标记为无效
    if (!hasCookies && !hasLocalStorage && !hasSessionStorage) {
      logger.debug(`${site.name}: 无任何凭证数据`);
      configManager.updateSite(site.id, { cookieValid: false });
      changed = true;
      continue;
    }

    // 如果只有localStorage/sessionStorage，不做HTTP检测，直接认为有效
    if (!hasCookies && (hasLocalStorage || hasSessionStorage)) {
      logger.debug(
        `${site.name}: 使用localStorage/sessionStorage登录（跳过Cookie检测）`
      );
      if (!site.cookieValid) {
        configManager.updateSite(site.id, {
          cookieValid: true,
          credentialsUpdatedAt: stored.updatedAt,
        });
        changed = true;
      }
      continue;
    }

    // 有Cookie的情况，进行HTTP检测
    const cookieHeader = buildCookieHeader(stored.cookies);
    const isValid = await checkSiteWithCookies(site.url, cookieHeader);

    if (site.cookieValid !== isValid) {
      configManager.updateSite(site.id, {
        cookieValid: isValid,
        credentialsUpdatedAt: stored.updatedAt,
      });
      changed = true;
    }
  }

  if (changed) {
    configManager.save();
  }
}
