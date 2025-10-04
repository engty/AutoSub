/**
 * HTTP API 订阅提取器
 *
 * 通过纯 HTTP 请求获取订阅地址，无需浏览器
 */

import axios, { AxiosRequestConfig } from 'axios';
import * as https from 'https';
import { SiteConfig, HttpApiConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { readCredentials } from '../credentials/manager.js';
import { buildSubscriptionUrl, updateHostAndPort, isValidUrlComponents } from '../utils/subscription-url-parser.js';

export class HttpApiExtractor {
  /**
   * 从SiteConfig中提取订阅地址（使用保存的API配置）
   */
  async extractFromSite(siteConfig: SiteConfig): Promise<string | null> {
    if (!siteConfig.api) {
      logger.warn('站点未配置API信息，无法使用HTTP API提取');
      return null;
    }

    try {
      return await this.extract(siteConfig, siteConfig.api);
    } catch (error) {
      logger.error('HTTP API提取失败', error);
      // 向上层抛出原始错误，保留错误类型信息
      throw error;
    }
  }

  /**
   * 通过 HTTP API 提取订阅地址
   */
  async extract(siteConfig: SiteConfig, apiConfig: HttpApiConfig): Promise<string> {
    try {
      logger.info(`使用 HTTP API 获取订阅地址: ${apiConfig.url}`);

      // 1. 加载凭证
      const credentials = await readCredentials(siteConfig.id);
      if (!credentials) {
        const error = new Error('未找到凭证文件') as any;
        error.code = 'CREDENTIALS_NOT_FOUND';
        throw error;
      }

      // 2. 根据认证方式验证凭证
      const authSource = apiConfig.authSource || 'cookie';
      const hasCookies = credentials.cookies && Array.isArray(credentials.cookies) && credentials.cookies.length > 0;
      const hasLocalStorage = credentials.localStorage && Object.keys(credentials.localStorage).length > 0;

      // 调试日志：输出凭证详情
      logger.debug('凭证验证详情:', {
        siteId: siteConfig.id,
        siteName: siteConfig.name,
        authSource,
        cookiesType: Array.isArray(credentials.cookies) ? 'array' : typeof credentials.cookies,
        cookiesLength: Array.isArray(credentials.cookies) ? credentials.cookies.length : 'N/A',
        hasCookies,
        localStorageKeys: Object.keys(credentials.localStorage || {}).length,
        hasLocalStorage,
      });

      // 检查是否有所需的认证数据
      if (authSource === 'cookie' && !hasCookies) {
        const cookieInfo = Array.isArray(credentials.cookies)
          ? `cookies数组为空(length=${credentials.cookies.length})`
          : `cookies类型错误(type=${typeof credentials.cookies})`;
        const error = new Error(`未找到有效的 Cookie 凭证: ${cookieInfo}`) as any;
        error.code = 'CREDENTIALS_NOT_FOUND';
        logger.error('Cookie验证失败', {
          siteId: siteConfig.id,
          cookieInfo,
          credentialsFile: siteConfig.credentialFile
        });
        throw error;
      }

      if (authSource === 'localStorage' && !hasLocalStorage) {
        const error = new Error('未找到有效的 localStorage 凭证') as any;
        error.code = 'CREDENTIALS_NOT_FOUND';
        throw error;
      }

      if (authSource === 'both' && !hasCookies && !hasLocalStorage) {
        const error = new Error('未找到有效的 Cookie 或 localStorage 凭证') as any;
        error.code = 'CREDENTIALS_NOT_FOUND';
        throw error;
      }

      // 3. 构建请求配置
      const requestConfig = this.buildRequestConfig(apiConfig, credentials.cookies, credentials.localStorage);

      // 3. 发送请求
      const response = await axios(requestConfig);

      // 调试：打印响应数据
      logger.info('API 响应状态:', response.status);
      logger.info('API 响应数据:', JSON.stringify(response.data, null, 2));

      // 4. 检查认证状态
      if (response.status === 401 || response.status === 403) {
        // 检查响应消息是否包含登录过期相关关键词
        const responseText = JSON.stringify(response.data).toLowerCase();
        const authExpiredKeywords = ['未登录', '登录已过期', '登陆已过期', 'not logged', 'login expired', 'unauthorized'];

        if (authExpiredKeywords.some(keyword => responseText.includes(keyword))) {
          const error = new Error(`认证已过期: ${response.data?.message || '未登录或登录已过期'}`) as any;
          error.code = 'AUTH_EXPIRED';
          error.statusCode = response.status;
          throw error;
        }
      }

      // 5. 从响应中提取订阅地址
      let subscriptionUrl: string | null = null;

      // ========== 方式1（优先级最高）: 直接提取完整订阅地址 ==========
      // API返回的完整URL包含所有必要参数（如token、timestamp、sign等）
      if (apiConfig.subscribeUrlField) {
        subscriptionUrl = this.extractFieldFromResponse(response.data, apiConfig.subscribeUrlField);
        if (subscriptionUrl) {
          logger.info(`从响应字段提取完整订阅地址: ${subscriptionUrl.substring(0, 80)}...`);

          // 检查是否需要进行URL格式转换（针对某些站点返回错误格式的URL）
          if (apiConfig.subscriptionUrl && isValidUrlComponents(apiConfig.subscriptionUrl)) {
            subscriptionUrl = this.tryFixSubscriptionUrl(subscriptionUrl, apiConfig);
          }
        }
      }

      // ========== 方式2: 使用URL组件配置动态构建 ==========
      // 支持动态更新host/port，适应IP地址和端口变化
      // 注意：只在没有完整URL时使用
      if (!subscriptionUrl && apiConfig.subscriptionUrl && isValidUrlComponents(apiConfig.subscriptionUrl)) {
        logger.info('使用URL组件模式构建订阅地址');

        // 提取token
        if (!apiConfig.tokenField) {
          throw new Error('URL组件模式需要配置 tokenField');
        }

        const token = this.extractFieldFromResponse(response.data, apiConfig.tokenField);
        if (!token) {
          throw new Error(`无法从响应中提取token (字段: ${apiConfig.tokenField})`);
        }

        // 更新host和port（如果API返回了完整URL）
        let updatedComponents = apiConfig.subscriptionUrl;
        if (apiConfig.urlField) {
          const fullUrl = this.extractFieldFromResponse(response.data, apiConfig.urlField);
          if (fullUrl) {
            logger.info(`从API响应更新host/port: ${fullUrl}`);
            updatedComponents = updateHostAndPort(apiConfig.subscriptionUrl, fullUrl);

            // 保存更新后的组件到siteConfig（这样下次请求可以使用新的host/port）
            if (siteConfig.api) {
              siteConfig.api.subscriptionUrl = updatedComponents;
              logger.debug('已更新配置中的host/port');
            }
          }
        }

        // 构建最终订阅地址
        subscriptionUrl = buildSubscriptionUrl(updatedComponents, token);
        logger.info(`✓ URL组件模式构建成功: ${subscriptionUrl.substring(0, 50)}...`);
      }

      // ========== 方式3: 使用传统 token + URL 模式（向后兼容）==========
      if (!subscriptionUrl && apiConfig.tokenField && apiConfig.subscribeUrlPattern) {
        const token = this.extractFieldFromResponse(response.data, apiConfig.tokenField);
        if (token) {
          subscriptionUrl = apiConfig.subscribeUrlPattern.replace('{token}', token);
          logger.info(`使用 Token 构建订阅地址: ${subscriptionUrl.substring(0, 50)}...`);
        }
      }

      if (!subscriptionUrl) {
        throw new Error(`未能从响应中提取订阅地址`);
      }

      logger.info(`✓ 成功获取订阅地址: ${subscriptionUrl.substring(0, 50)}...`);
      return subscriptionUrl;

    } catch (error: any) {
      // 保留错误代码，便于上层识别错误类型
      if (error.code) {
        throw error;
      }

      logger.error('HTTP API 提取失败', error);
      const newError = new Error(`HTTP API 提取订阅地址失败: ${error instanceof Error ? error.message : String(error)}`) as any;
      newError.originalError = error;
      throw newError;
    }
  }

  /**
   * 构建 Axios 请求配置
   */
  private buildRequestConfig(apiConfig: HttpApiConfig, cookies: any[], localStorage?: Record<string, string>): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      url: apiConfig.url,
      method: apiConfig.method,
      timeout: 30000,
      validateStatus: () => true, // 接受所有状态码
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // 允许自签名证书
      }),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': apiConfig.url,
        ...apiConfig.headers,
      },
    };

    // 根据authSource添加认证信息
    if (apiConfig.authSource === 'cookie' || apiConfig.authSource === 'both') {
      // 添加Cookie认证
      const cookieString = cookies
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
      config.headers!['Cookie'] = cookieString;
      logger.debug('已添加Cookie认证');
    }

    if (apiConfig.authSource === 'localStorage' || apiConfig.authSource === 'both') {
      // 添加localStorage Token认证
      const authToken = this.extractAuthToken(localStorage, apiConfig.authField);
      if (authToken) {
        config.headers!['Authorization'] = authToken;
        logger.debug('已添加Authorization头');
      } else {
        logger.warn('未能从localStorage提取认证Token');
      }
    }

    // 添加 URL 参数
    if (apiConfig.params) {
      config.params = apiConfig.params;
    }

    // 添加请求体（POST）
    if (apiConfig.method === 'POST' && apiConfig.body) {
      config.data = apiConfig.body;
    }

    return config;
  }

  /**
   * 从localStorage提取认证Token
   */
  private extractAuthToken(localStorage?: Record<string, string>, authField?: string): string | null {
    if (!localStorage || !authField) {
      return null;
    }

    try {
      const keys = authField.split('.');
      let value: any = localStorage;

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        if (i === 0) {
          // 第一层：直接从localStorage获取
          if (key in localStorage) {
            value = localStorage[key];

            // 如果这是最后一个key，直接返回
            if (i === keys.length - 1) {
              return typeof value === 'string' ? value : null;
            }

            // 如果还有嵌套路径，尝试解析JSON
            if (typeof value === 'string') {
              try {
                value = JSON.parse(value);
              } catch {
                logger.warn(`无法解析localStorage["${key}"]为JSON: ${value.substring(0, 50)}...`);
                return null;
              }
            }
          } else {
            logger.warn(`localStorage中不存在字段: ${key}`);
            return null;
          }
        } else {
          // 后续层级：从解析后的对象中获取
          if (value && typeof value === 'object' && key in value) {
            value = value[key];
          } else {
            logger.warn(`authField路径 "${authField}" 中的 "${key}" 不存在`);
            return null;
          }
        }
      }

      return typeof value === 'string' ? value : null;

    } catch (error) {
      logger.error('提取认证Token失败', error);
      return null;
    }
  }

  /**
   * 从响应对象中提取指定字段
   *
   * @param data 响应数据
   * @param fieldPath 字段路径，如 "data.subscribe_url" 或 "result.url"
   */
  private extractFieldFromResponse(data: any, fieldPath: string): string | null {
    try {
      const keys = fieldPath.split('.');
      let value = data;

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          logger.warn(`字段路径 "${fieldPath}" 中的 "${key}" 不存在`);
          return null;
        }
      }

      // 检查最终值是否为字符串
      if (typeof value === 'string') {
        return value;
      }

      logger.warn(`字段 "${fieldPath}" 的值不是字符串类型: ${typeof value}`);
      return null;

    } catch (error) {
      logger.error('提取字段失败', error);
      return null;
    }
  }

  /**
   * 尝试修复订阅地址格式
   * 将API返回的URL转换为正确的订阅地址格式
   *
   * @param apiUrl API返回的订阅地址（可能格式不正确）
   * @param apiConfig API配置（包含正确的URL组件）
   * @returns 修复后的订阅地址
   */
  private tryFixSubscriptionUrl(apiUrl: string, apiConfig: HttpApiConfig): string {
    try {
      const urlObj = new URL(apiUrl);

      // 从URL中提取token（可能在路径中，也可能在查询参数中）
      let token: string | null = null;

      // 1. 先尝试从查询参数中获取token
      const urlParams = new URLSearchParams(urlObj.search);
      token = urlParams.get('token') || urlParams.get(apiConfig.subscriptionUrl?.tokenParam || 'token');

      // 2. 如果查询参数中没有token，尝试从路径中提取（处理 /sub/{token} 格式）
      if (!token) {
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        const subIndex = pathParts.indexOf('sub');
        if (subIndex !== -1 && pathParts.length > subIndex + 1) {
          token = pathParts[subIndex + 1];
          logger.debug(`从路径中提取token: ${token.substring(0, 10)}...`);
        } else if (pathParts.length > 0) {
          // 如果没有 /sub/ 前缀，尝试使用最后一个路径段作为token
          token = pathParts[pathParts.length - 1];
          logger.debug(`从路径末尾提取token: ${token.substring(0, 10)}...`);
        }
      }

      if (!token) {
        logger.warn('无法从API返回的URL中提取token，使用原URL');
        return apiUrl;
      }

      // 3. 使用正确的URL组件配置重建订阅地址
      if (apiConfig.subscriptionUrl && isValidUrlComponents(apiConfig.subscriptionUrl)) {
        const correctUrl = buildSubscriptionUrl(apiConfig.subscriptionUrl, token);

        // 4. 复制原URL中的所有其他查询参数（timestamp、sign等）
        const additionalParams = new URLSearchParams();
        urlParams.forEach((value, key) => {
          // 跳过token参数（因为已经在buildSubscriptionUrl中添加了）
          if (key !== 'token' && key !== (apiConfig.subscriptionUrl?.tokenParam || 'token')) {
            additionalParams.append(key, value);
          }
        });

        // 如果有额外参数，添加到重建的URL中
        if (additionalParams.toString()) {
          const separator = correctUrl.includes('?') ? '&' : '?';
          const finalUrl = `${correctUrl}${separator}${additionalParams.toString()}`;
          logger.info(`✓ URL格式已转换（含额外参数）: ${apiUrl.substring(0, 50)}... → ${finalUrl.substring(0, 50)}...`);
          return finalUrl;
        }

        logger.info(`✓ URL格式已转换: ${apiUrl.substring(0, 50)}... → ${correctUrl.substring(0, 50)}...`);
        return correctUrl;
      }

      // 如果没有URL组件配置，返回原URL
      logger.debug('没有URL组件配置，使用原URL');
      return apiUrl;

    } catch (error) {
      logger.warn(`URL格式转换失败，使用原URL: ${error}`);
      return apiUrl;
    }
  }

  /**
   * 测试 API 配置是否有效
   */
  async testApiConfig(siteConfig: SiteConfig, apiConfig: HttpApiConfig): Promise<{
    success: boolean;
    subscriptionUrl?: string;
    error?: string;
  }> {
    try {
      const subscriptionUrl = await this.extract(siteConfig, apiConfig);
      return {
        success: true,
        subscriptionUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
