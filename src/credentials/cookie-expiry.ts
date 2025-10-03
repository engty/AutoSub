import { readCredentials } from './manager.js';
import { logger } from '../utils/logger.js';

/**
 * Cookie过期信息
 */
export interface CookieExpiryInfo {
  type: 'session' | 'persistent' | 'none';
  expiryDate?: Date;
  daysLeft?: number;
  needsRefresh: boolean;
  hasExpired: boolean;
}

/**
 * 获取站点Cookie的过期信息
 */
export async function getCookieExpiryInfo(siteId: string): Promise<CookieExpiryInfo> {
  try {
    const stored = await readCredentials(siteId);

    if (!stored || !Array.isArray(stored.cookies) || stored.cookies.length === 0) {
      return {
        type: 'none',
        needsRefresh: false,
        hasExpired: true,
      };
    }

    let nearestExpiry = Infinity;
    let hasSessionCookie = false;

    for (const cookie of stored.cookies) {
      if (!cookie.expires) {
        // Session Cookie（浏览器关闭即失效）
        hasSessionCookie = true;
        continue;
      }

      // expires是Unix时间戳（秒）
      const expiryTime = typeof cookie.expires === 'number' ? cookie.expires : 0;
      if (expiryTime > 0 && expiryTime < nearestExpiry) {
        nearestExpiry = expiryTime;
      }
    }

    // 只有Session Cookie
    if (nearestExpiry === Infinity) {
      return {
        type: 'session',
        needsRefresh: true, // Session Cookie建议刷新
        hasExpired: false,
      };
    }

    // 计算剩余天数
    const now = Date.now() / 1000;
    const secondsLeft = nearestExpiry - now;
    const daysLeft = secondsLeft / 86400;

    return {
      type: 'persistent',
      expiryDate: new Date(nearestExpiry * 1000),
      daysLeft: Math.ceil(daysLeft),
      needsRefresh: daysLeft < 3, // 剩余不足3天需要刷新
      hasExpired: daysLeft < 0,
    };
  } catch (error) {
    logger.warn(`获取Cookie过期信息失败(${siteId}): ${error instanceof Error ? error.message : String(error)}`);
    return {
      type: 'none',
      needsRefresh: false,
      hasExpired: true,
    };
  }
}

/**
 * 对比Cookie是否被刷新（expires时间是否延长）
 */
export function compareCookieExpiry(oldCookies: Array<Record<string, any>>, newCookies: Array<Record<string, any>>): boolean {
  let hasRefreshed = false;

  for (const newCookie of newCookies) {
    const oldCookie = oldCookies.find((c) => c.name === newCookie.name);

    if (!oldCookie) continue;

    // 对比expires时间戳
    const oldExpires = typeof oldCookie.expires === 'number' ? oldCookie.expires : 0;
    const newExpires = typeof newCookie.expires === 'number' ? newCookie.expires : 0;

    if (newExpires > oldExpires && newExpires > 0) {
      const extensionDays = (newExpires - oldExpires) / 86400;
      logger.debug(`Cookie "${newCookie.name}" 有效期延长了 ${extensionDays.toFixed(1)} 天`);
      hasRefreshed = true;
    }
  }

  return hasRefreshed;
}

/**
 * 格式化Cookie过期信息为用户友好的字符串
 */
export function formatExpiryInfo(info: CookieExpiryInfo): string {
  if (info.type === 'none') {
    return '无Cookie';
  }

  if (info.type === 'session') {
    return 'Session Cookie（浏览器关闭失效）';
  }

  if (info.hasExpired) {
    return `已过期 ${Math.abs(info.daysLeft || 0)} 天`;
  }

  if (info.needsRefresh) {
    return `剩余 ${info.daysLeft} 天（建议刷新）`;
  }

  return `剩余 ${info.daysLeft} 天`;
}
