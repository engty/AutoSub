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
      const hasCookies = credentials.cookies && credentials.cookies.length > 0;
      const hasLocalStorage = credentials.localStorage && Object.keys(credentials.localStorage).length > 0;

      // 检查是否有所需的认证数据
      if (authSource === 'cookie' && !hasCookies) {
        const error = new Error('未找到有效的 Cookie 凭证') as any;
        error.code = 'CREDENTIALS_NOT_FOUND';
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

      // ========== 方式1: 使用URL组件配置（新的推荐方式）==========
      // 支持动态更新host/port，适应IP地址和端口变化
      if (apiConfig.subscriptionUrl && isValidUrlComponents(apiConfig.subscriptionUrl)) {
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

      // ========== 方式2: 使用传统 token + URL 模式（向后兼容）==========
      else if (apiConfig.tokenField && apiConfig.subscribeUrlPattern) {
        const token = this.extractFieldFromResponse(response.data, apiConfig.tokenField);
        if (token) {
          subscriptionUrl = apiConfig.subscribeUrlPattern.replace('{token}', token);
          logger.info(`使用 Token 构建订阅地址: ${subscriptionUrl.substring(0, 50)}...`);
        }
      }

      // ========== 方式3: 直接提取订阅地址字段（向后兼容）==========
      else if (apiConfig.subscribeUrlField) {
        subscriptionUrl = this.extractFieldFromResponse(response.data, apiConfig.subscribeUrlField);
        if (subscriptionUrl) {
          logger.info(`从响应字段提取订阅地址: ${subscriptionUrl.substring(0, 50)}...`);
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

      for (const key of keys) {
        if (key in value) {
          // 如果是JSON字符串，先解析
          if (typeof value[key] === 'string' && value[key].startsWith('{')) {
            value = JSON.parse(value[key]);
          } else {
            value = value[key];
          }
        } else {
          logger.warn(`authField路径 "${authField}" 中的 "${key}" 不存在`);
          return null;
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
