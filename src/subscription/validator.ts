import axios from 'axios';
import yaml from 'js-yaml';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError } from '../types/index.js';

/**
 * 订阅验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 节点数量 */
  nodeCount: number;
  /** 错误信息 */
  error?: string;
  /** 配置内容 */
  config?: any;
}

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

      // 1. HTTP 请求验证
      const response = await this.fetchSubscription(subscriptionUrl);

      if (!response) {
        return {
          valid: false,
          nodeCount: 0,
          error: 'HTTP 请求失败',
        };
      }

      // 2. 内容格式验证
      const config = this.parseSubscriptionContent(response.data);

      if (!config) {
        return {
          valid: false,
          nodeCount: 0,
          error: '订阅内容格式无效',
        };
      }

      // 3. 节点数量验证
      const nodeCount = this.countNodes(config);

      if (nodeCount === 0) {
        return {
          valid: false,
          nodeCount: 0,
          error: '订阅中没有可用节点',
        };
      }

      logger.info(`✓ 订阅验证通过，包含 ${nodeCount} 个节点`);

      return {
        valid: true,
        nodeCount,
        config,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error('订阅验证失败', error);

      return {
        valid: false,
        nodeCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * 获取订阅内容
   */
  private async fetchSubscription(url: string): Promise<any> {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        validateStatus: (status) => status === 200,
      });

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
  private parseSubscriptionContent(content: string): any {
    try {
      // 尝试 YAML 解析
      const config = yaml.load(content);

      if (!config || typeof config !== 'object') {
        return null;
      }

      return config;
    } catch (error) {
      logger.debug('YAML 解析失败', error);

      // 尝试 Base64 解码（部分订阅是 Base64 编码的）
      try {
        const decoded = Buffer.from(content, 'base64').toString('utf-8');
        return yaml.load(decoded);
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
    const oldNodes = new Set(
      (oldConfig.proxies || []).map((p: any) => p.name || p.server)
    );
    const newNodes = new Set(
      (newConfig.proxies || []).map((p: any) => p.name || p.server)
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
