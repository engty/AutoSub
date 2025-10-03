import axios from 'axios';
import type { AxiosResponse } from 'axios';
import yaml from 'js-yaml';
import https from 'https';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError, ValidationResult } from '../types/index.js';
import { getAIService } from '../ai/index.js';

/**
 * 订阅验证器
 * 验证订阅地址的有效性
 */
export class SubscriptionValidator {
  /**
   * 验证订阅地址
   */
  async validate(subscriptionUrl: string): Promise<ValidationResult> {
    try {
      logger.info(`开始验证订阅地址: ${subscriptionUrl}`);

      const response = await this.fetchSubscription(subscriptionUrl);

      const status = response.status;
      const responseData = String(response.data || '');

      // 使用 AI 分析响应内容
      const analysis = await this.analyzeResponseWithAI(responseData, status);

      const result: ValidationResult = {
        valid: analysis.valid,
        httpStatus: status,
      };

      if (!analysis.valid) {
        // AI 判断为无效
        result.error = analysis.reason || `订阅地址无效`;
        logger.error(`✗ 订阅验证失败: ${result.error}`);
        return result;
      }

      // AI 判断为有效，继续解析配置
      logger.info(`✓ 订阅地址验证通过 (HTTP ${status})`);

      const config = this.parseSubscriptionContent(response.data);

      if (config) {
        const nodeCount = this.countNodes(config);

        if (nodeCount > 0) {
          result.config = config;
          result.nodeCount = nodeCount;
          logger.info(`✓ 订阅包含 ${nodeCount} 个节点`);
        } else {
          result.nodeCount = nodeCount;
          result.warning = '订阅节点数量无法统计，已跳过 Clash 合并';
          logger.warn(result.warning);
        }
      } else if (response.data) {
        result.warning = '订阅内容未解析，已跳过 Clash 合并';
        logger.warn(result.warning);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('订阅验证失败', error);

      return {
        valid: false,
        error: errorMessage,
        nodeCount: 0,
      };
    }
  }

  /**
   * 获取订阅内容
   */
  private async fetchSubscription(url: string): Promise<AxiosResponse<string>> {
    try {
      // 创建 HTTPS Agent 忽略 SSL 证书验证（等同于 curl -k）
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false, // 忽略自签名证书
      });

      const response = await axios.get<string>(url, {
        timeout: 30000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        responseType: 'text', // 强制以文本形式接收
        validateStatus: () => true, // 始终返回响应，后续判断状态码
        httpsAgent, // 使用自定义 HTTPS Agent
      });

      logger.debug(`订阅响应状态: ${response.status}`);
      logger.debug(`订阅响应类型: ${typeof response.data}`);
      logger.debug(`订阅内容前100字符: ${String(response.data).substring(0, 100)}`);

      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new AutoSubError(
            ErrorCode.SUBSCRIPTION_VALIDATION_FAILED,
            `HTTP ${error.response.status}: ${error.response.statusText}`
          );
        } else if (error.request) {
          throw new AutoSubError(
            ErrorCode.SUBSCRIPTION_VALIDATION_FAILED,
            '网络请求超时或无响应'
          );
        }
      }
      throw error;
    }
  }

  /**
   * 解析订阅内容
   */
  private parseSubscriptionContent(content: any): any {
    try {
      // 如果 content 已经是对象，直接返回
      if (typeof content === 'object' && content !== null) {
        logger.debug('订阅内容已经是对象格式');
        return content;
      }

      // 如果是字符串，尝试 YAML 解析
      if (typeof content === 'string') {
        logger.debug(`订阅内容是字符串，长度: ${content.length}`);
        const config = yaml.load(content);

        if (!config || typeof config !== 'object') {
          return null;
        }

        return config;
      }

      logger.warn(`未知的订阅内容类型: ${typeof content}`);
      return null;
    } catch (error) {
      logger.debug('YAML 解析失败', error);

      // 尝试 Base64 解码（部分订阅是 Base64 编码的）
      try {
        if (typeof content === 'string') {
          const decoded = Buffer.from(content, 'base64').toString('utf-8');
          return yaml.load(decoded);
        }
        return null;
      } catch {
        return null;
      }
    }
  }

  /**
   * 统计节点数量
   */
  private countNodes(config: any): number {
    let count = 0;

    // Clash 配置格式
    if (config.proxies && Array.isArray(config.proxies)) {
      count += config.proxies.length;
    }

    // 检查代理组中的节点
    if (config['proxy-groups'] && Array.isArray(config['proxy-groups'])) {
      const allProxies = new Set<string>();

      for (const group of config['proxy-groups']) {
        if (group.proxies && Array.isArray(group.proxies)) {
          group.proxies.forEach((proxy: string) => {
            // 排除策略组自身
            if (
              !['DIRECT', 'REJECT', 'PASS'].includes(proxy) &&
              !proxy.includes('♻️') &&
              !proxy.includes('🔰')
            ) {
              allProxies.add(proxy);
            }
          });
        }
      }

      // 如果 proxies 为空，使用代理组中的节点数
      if (count === 0) {
        count = allProxies.size;
      }
    }

    return count;
  }

  /**
   * 使用 AI 分析响应内容是否有效
   * @param responseData 响应内容（可能是JSON字符串或其他文本）
   * @param statusCode HTTP状态码
   * @returns 返回分析结果：{valid: boolean, reason?: string}
   */
  private async analyzeResponseWithAI(
    responseData: string,
    statusCode: number
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      // 如果响应内容为空，认为无效
      if (!responseData || responseData.trim().length === 0) {
        return { valid: false, reason: '响应内容为空' };
      }

      // 尝试解析为 JSON
      let jsonData: any = null;
      let isJson = false;

      try {
        jsonData = JSON.parse(responseData);
        isJson = true;
      } catch {
        // 不是JSON，可能是YAML或其他格式
      }

      // 如果是JSON，检查常见的错误模式
      if (isJson && jsonData) {
        // 检查明确的错误标识
        if (jsonData.status === 'fail' || jsonData.status === 'error') {
          return {
            valid: false,
            reason: `服务器返回错误: ${jsonData.message || jsonData.error || '未知错误'}`,
          };
        }

        if (jsonData.error || jsonData.err) {
          return {
            valid: false,
            reason: `错误: ${jsonData.error || jsonData.err}`,
          };
        }

        // 检查token错误
        if (jsonData.message && typeof jsonData.message === 'string') {
          const msg = jsonData.message.toLowerCase();
          if (
            msg.includes('token') &&
            (msg.includes('error') ||
              msg.includes('invalid') ||
              msg.includes('expired') ||
              msg.includes('错误') ||
              msg.includes('无效') ||
              msg.includes('过期'))
          ) {
            return { valid: false, reason: `Token错误: ${jsonData.message}` };
          }
        }
      }

      // 调用 AI 分析响应内容
      const aiService = getAIService();
      if (!aiService) {
        // AI 未配置，回退到简单规则判断
        logger.debug('AI 未配置，使用简单规则判断');
        return this.simpleResponseAnalysis(responseData, statusCode);
      }

      const prompt = `分析以下订阅服务器的响应内容，判断订阅地址是否有效。

HTTP状态码: ${statusCode}
响应内容:
\`\`\`
${responseData.substring(0, 500)}
\`\`\`

判断标准：
1. 如果响应包含"token is error"、"invalid token"、"expired"、"unauthorized"等错误信息，则无效
2. 如果响应包含 status: "fail" 或 error 字段，则无效
3. 如果响应是有效的订阅配置（YAML/Base64格式），则有效
4. 如果响应包含节点配置信息（proxies、servers等），则有效

请用JSON格式回答：{"valid": true/false, "reason": "判断理由"}`;

      const result = await aiService.chat(prompt);
      logger.debug(`AI 分析结果: ${result}`);

      // 解析 AI 返回的 JSON
      const jsonMatch = result.match(/\{[^{}]*"valid"[^{}]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          valid: analysis.valid === true,
          reason: analysis.reason || undefined,
        };
      }

      // AI 返回格式不正确，使用简单规则
      logger.warn('AI 返回格式不正确，使用简单规则判断');
      return this.simpleResponseAnalysis(responseData, statusCode);
    } catch (error) {
      logger.debug('AI 分析失败，使用简单规则判断', error);
      return this.simpleResponseAnalysis(responseData, statusCode);
    }
  }

  /**
   * 简单规则分析响应内容（AI 不可用时的回退方案）
   */
  private simpleResponseAnalysis(
    responseData: string,
    statusCode: number
  ): { valid: boolean; reason?: string } {
    const lowerData = responseData.toLowerCase();

    // 检查明确的错误关键词
    const errorKeywords = [
      'token is error',
      'token error',
      'invalid token',
      'token expired',
      'unauthorized',
      'access denied',
      'forbidden',
      '\'status\':\'fail\'',
      '"status":"fail"',
      '\'status\':\'error\'',
      '"status":"error"',
    ];

    for (const keyword of errorKeywords) {
      if (lowerData.includes(keyword)) {
        return { valid: false, reason: `响应包含错误: ${keyword}` };
      }
    }

    // HTTP 状态码非 2xx 认为无效
    if (statusCode < 200 || statusCode >= 300) {
      return { valid: false, reason: `HTTP状态码 ${statusCode}` };
    }

    // 检查是否包含订阅配置的特征
    const validKeywords = ['proxies', 'servers', 'vmess://', 'trojan://', 'ss://'];
    const hasValidContent = validKeywords.some((keyword) => lowerData.includes(keyword));

    if (hasValidContent) {
      return { valid: true };
    }

    // 默认认为有效（保守策略）
    return { valid: true };
  }

  /**
   * 快速验证（检查 HTTP 可达性并分析响应内容）
   */
  async quickValidate(subscriptionUrl: string): Promise<boolean> {
    try {
      // 创建 HTTPS Agent 忽略 SSL 证书验证
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });

      const response = await axios.get(subscriptionUrl, {
        timeout: 10000,
        validateStatus: () => true, // 接受所有状态码
        httpsAgent,
        responseType: 'text',
      });

      const responseData = String(response.data || '');

      // 使用 AI 分析响应内容
      const analysis = await this.analyzeResponseWithAI(responseData, response.status);

      return analysis.valid;
    } catch {
      return false;
    }
  }

  /**
   * 比较两个订阅的节点差异
   */
  compareSubscriptions(oldConfig: any, newConfig: any): {
    added: string[];
    removed: string[];
    unchanged: string[];
  } {
    const oldNodes = new Set<string>(
      (oldConfig.proxies || [])
        .map((p: any) => p.name || p.server)
        .filter((value: unknown): value is string => typeof value === 'string')
    );
    const newNodes = new Set<string>(
      (newConfig.proxies || [])
        .map((p: any) => p.name || p.server)
        .filter((value: unknown): value is string => typeof value === 'string')
    );

    const added: string[] = [];
    const removed: string[] = [];
    const unchanged: string[] = [];

    for (const node of newNodes) {
      if (!oldNodes.has(node)) {
        added.push(node);
      } else {
        unchanged.push(node);
      }
    }

    for (const node of oldNodes) {
      if (!newNodes.has(node)) {
        removed.push(node);
      }
    }

    return { added, removed, unchanged };
  }
}
