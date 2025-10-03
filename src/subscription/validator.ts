import axios from 'axios';
import type { AxiosResponse } from 'axios';
import yaml from 'js-yaml';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError, ValidationResult } from '../types/index.js';

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
      const result: ValidationResult = {
        valid: status === 200,
        httpStatus: status,
      };

      if (status === 200) {
        logger.info('✓ 订阅地址可访问 (HTTP 200)');

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
      } else {
        result.error = `订阅地址返回状态码 ${status}`;
        logger.error(result.error);
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
      const response = await axios.get<string>(url, {
        timeout: 30000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        responseType: 'text', // 强制以文本形式接收
        validateStatus: () => true, // 始终返回响应，后续判断状态码
      });

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
   * 快速验证（仅检查 HTTP 可达性）
   */
  async quickValidate(subscriptionUrl: string): Promise<boolean> {
    try {
      const response = await axios.head(subscriptionUrl, {
        timeout: 10000,
        validateStatus: (status) => status === 200,
      });

      return response.status === 200;
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
