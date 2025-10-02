import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError } from '../types/index.js';

/**
 * MCP 客户端管理器
 * 负责与 Chrome DevTools MCP Server 的连接和通信
 */
export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected: boolean = false;

  /**
   * 初始化并连接到 MCP Server
   */
  async connect(): Promise<void> {
    try {
      logger.info('正在连接到 Chrome DevTools MCP Server...');

      // 创建 stdio 传输层
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-chrome-devtools'],
      });

      // 创建客户端
      this.client = new Client(
        {
          name: 'clash-autosub',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // 连接到服务器
      await this.client.connect(this.transport);

      this.isConnected = true;
      logger.info('✓ 成功连接到 Chrome DevTools MCP Server');

      // 列出可用工具
      const tools = await this.listTools();
      logger.debug(`可用工具: ${tools.map((t) => t.name).join(', ')}`);
    } catch (error) {
      this.isConnected = false;
      throw new AutoSubError(
        ErrorCode.MCP_CONNECTION_FAILED,
        `MCP 连接失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        this.isConnected = false;
        logger.info('已断开 MCP 连接');
      } catch (error) {
        logger.error('断开 MCP 连接时出错', error);
      }
    }
  }

  /**
   * 列出所有可用工具
   */
  async listTools(): Promise<Array<{ name: string; description?: string }>> {
    this.ensureConnected();

    try {
      const result = await this.client!.request(
        { method: 'tools/list' },
        ListToolsResultSchema
      );

      return result.tools;
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.MCP_TOOL_CALL_FAILED,
        `列出工具失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(name: string, args?: Record<string, unknown>): Promise<any> {
    this.ensureConnected();

    try {
      logger.debug(`调用 MCP 工具: ${name}`, args);

      const result = await this.client!.request(
        {
          method: 'tools/call',
          params: {
            name,
            arguments: args || {},
          },
        },
        CallToolResultSchema
      );

      return result;
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.MCP_TOOL_CALL_FAILED,
        `调用工具 ${name} 失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 确保已连接
   */
  private ensureConnected(): void {
    if (!this.isConnected || !this.client) {
      throw new AutoSubError(
        ErrorCode.MCP_CONNECTION_FAILED,
        'MCP 客户端未连接，请先调用 connect()'
      );
    }
  }

  /**
   * 检查连接状态
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

/**
 * 导出单例实例
 */
let mcpClientInstance: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient();
  }
  return mcpClientInstance;
}
