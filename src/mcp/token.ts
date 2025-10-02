import { NetworkListener } from './network.js';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError, MCPNetworkRequest } from '../types/index.js';

/**
 * Token 提取结果
 */
export interface TokenExtractionResult {
  /** 提取到的 token 值 */
  token: string;
  /** token 来源（URL） */
  source: string;
  /** token 类型（从哪个字段提取） */
  type: string;
}

/**
 * Token 提取器
 * 负责从 API 响应中提取各种 token
 */
export class TokenExtractor {
  private networkListener: NetworkListener;

  constructor(networkListener: NetworkListener) {
    this.networkListener = networkListener;
  }

  /**
   * 从所有 API 请求中提取 token
   */
  async extractFromApiRequests(): Promise<TokenExtractionResult[]> {
    try {
      const apiRequests = this.networkListener.findApiRequests();
      logger.info(`找到 ${apiRequests.length} 个 API 请求`);

      const results: TokenExtractionResult[] = [];

      for (const request of apiRequests) {
        const tokens = this.extractFromRequest(request);
        results.push(...tokens);
      }

      logger.info(`从 API 请求中提取到 ${results.length} 个 token`);
      return results;
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.TOKEN_EXTRACTION_FAILED,
        `提取 token 失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 从单个请求中提取 token
   */
  extractFromRequest(request: MCPNetworkRequest): TokenExtractionResult[] {
    const results: TokenExtractionResult[] = [];

    // 1. 从响应体中提取
    if (request.responseBody) {
      const bodyTokens = this.extractFromResponseBody(
        request.responseBody,
        request.url
      );
      results.push(...bodyTokens);
    }

    // 2. 从响应头中提取
    if (request.responseHeaders) {
      const headerTokens = this.extractFromHeaders(
        request.responseHeaders,
        request.url
      );
      results.push(...headerTokens);
    }

    return results;
  }

  /**
   * 从响应体中提取 token
   */
  private extractFromResponseBody(
    body: any,
    source: string
  ): TokenExtractionResult[] {
    const results: TokenExtractionResult[] = [];

    try {
      const data = typeof body === 'string' ? JSON.parse(body) : body;

      // 常见的 token 字段名
      const tokenFields = [
        'token',
        'accessToken',
        'access_token',
        'authToken',
        'auth_token',
        'jwt',
        'bearerToken',
        'bearer_token',
        'apiToken',
        'api_token',
        'sessionToken',
        'session_token',
        'refreshToken',
        'refresh_token',
      ];

      // 递归查找 token
      const findTokens = (obj: any, path: string = ''): void => {
        if (typeof obj !== 'object' || obj === null) return;

        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;

          // 检查是否是 token 字段
          const lowerKey = key.toLowerCase();
          if (tokenFields.some((field) => lowerKey.includes(field.toLowerCase()))) {
            if (typeof value === 'string' && value.length > 0) {
              results.push({
                token: value,
                source,
                type: currentPath,
              });
            }
          }

          // 递归查找
          if (typeof value === 'object') {
            findTokens(value, currentPath);
          }
        }
      };

      findTokens(data);
    } catch (error) {
      logger.debug('解析响应体失败，可能不是 JSON 格式');
    }

    return results;
  }

  /**
   * 从响应头中提取 token
   */
  private extractFromHeaders(
    headers: Record<string, string>,
    source: string
  ): TokenExtractionResult[] {
    const results: TokenExtractionResult[] = [];

    // 常见的 token 响应头
    const tokenHeaders = [
      'authorization',
      'x-auth-token',
      'x-access-token',
      'x-api-key',
      'x-session-token',
    ];

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();

      if (tokenHeaders.some((header) => lowerKey.includes(header))) {
        let token = value;

        // 移除 "Bearer " 前缀
        if (token.toLowerCase().startsWith('bearer ')) {
          token = token.substring(7);
        }

        if (token.length > 0) {
          results.push({
            token,
            source,
            type: `header.${key}`,
          });
        }
      }
    }

    return results;
  }

  /**
   * 通过 URL 模式查找并提取 token
   */
  async extractFromUrlPattern(urlPattern: string): Promise<TokenExtractionResult[]> {
    const requests = this.networkListener.filterRequests({ urlPattern });
    logger.info(`URL 模式 '${urlPattern}' 匹配到 ${requests.length} 个请求`);

    const results: TokenExtractionResult[] = [];

    for (const request of requests) {
      const tokens = this.extractFromRequest(request);
      results.push(...tokens);
    }

    return results;
  }

  /**
   * 通过关键词查找并提取 token
   */
  async extractFromKeyword(
    keyword: string,
    searchIn: 'url' | 'body' = 'url'
  ): Promise<TokenExtractionResult[]> {
    const requests = this.networkListener.findRequestsByKeyword(keyword, searchIn);
    logger.info(`关键词 '${keyword}' 匹配到 ${requests.length} 个请求`);

    const results: TokenExtractionResult[] = [];

    for (const request of requests) {
      const tokens = this.extractFromRequest(request);
      results.push(...tokens);
    }

    return results;
  }

  /**
   * 合并所有提取的 token（去重）
   */
  mergeTokens(results: TokenExtractionResult[]): string {
    const uniqueTokens = new Map<string, TokenExtractionResult>();

    for (const result of results) {
      if (!uniqueTokens.has(result.token)) {
        uniqueTokens.set(result.token, result);
      }
    }

    const tokens: string[] = [];
    for (const [token, info] of uniqueTokens) {
      tokens.push(`${info.type}=${token}`);
    }

    return tokens.join('\n');
  }

  /**
   * 格式化 token 结果为可读字符串
   */
  formatResults(results: TokenExtractionResult[]): string {
    if (results.length === 0) {
      return '未找到任何 token';
    }

    const lines: string[] = [];
    lines.push(`找到 ${results.length} 个 token:\n`);

    results.forEach((result, index) => {
      lines.push(`[${index + 1}] ${result.type}`);
      lines.push(`    来源: ${result.source}`);
      lines.push(`    值: ${result.token.substring(0, 50)}${result.token.length > 50 ? '...' : ''}`);
      lines.push('');
    });

    return lines.join('\n');
  }
}
