import { MCPClient } from './client.js';
import { logger } from '../utils/logger.js';
import { ErrorCode, AutoSubError, MCPPage } from '../types/index.js';

/**
 * 页面管理器
 * 负责管理浏览器页面的生命周期、导航和状态
 */
export class PageManager {
  private mcpClient: MCPClient;
  private currentPage: MCPPage | null = null;

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * 列出所有打开的页面
   */
  async listPages(): Promise<MCPPage[]> {
    try {
      const result = await this.mcpClient.callTool('mcp__chrome-devtools__list_pages');

      if (result.content && Array.isArray(result.content)) {
        const pages = result.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => {
            try {
              return JSON.parse(item.text);
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        return pages.flatMap((p: any) => p.pages || []);
      }

      return [];
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.PAGE_OPERATION_FAILED,
        `列出页面失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 创建新页面
   */
  async createPage(url: string, timeout: number = 30000): Promise<MCPPage> {
    try {
      logger.info(`创建新页面: ${url}`);

      await this.mcpClient.callTool('mcp__chrome-devtools__new_page', {
        url,
        timeout,
      });

      // 获取新创建的页面
      const pages = await this.listPages();
      const newPage = pages.find((p) => p.url === url) || pages[pages.length - 1];

      if (!newPage) {
        throw new Error('无法找到新创建的页面');
      }

      this.currentPage = newPage;
      logger.info(`✓ 页面创建成功 (索引: ${newPage.pageIdx})`);

      return newPage;
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.PAGE_OPERATION_FAILED,
        `创建页面失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 选择页面
   */
  async selectPage(pageIdx: number): Promise<void> {
    try {
      await this.mcpClient.callTool('mcp__chrome-devtools__select_page', {
        pageIdx,
      });

      const pages = await this.listPages();
      this.currentPage = pages.find((p) => p.pageIdx === pageIdx) || null;

      logger.debug(`已选择页面 ${pageIdx}`);
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.PAGE_OPERATION_FAILED,
        `选择页面失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 导航到 URL
   */
  async navigateTo(url: string, timeout: number = 30000): Promise<void> {
    try {
      logger.info(`导航到: ${url}`);

      await this.mcpClient.callTool('mcp__chrome-devtools__navigate_page', {
        url,
        timeout,
      });

      if (this.currentPage) {
        this.currentPage.url = url;
      }

      logger.info(`✓ 导航成功`);
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.PAGE_OPERATION_FAILED,
        `页面导航失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 等待指定文本出现
   */
  async waitForText(text: string, timeout: number = 10000): Promise<void> {
    try {
      logger.debug(`等待文本出现: ${text}`);

      await this.mcpClient.callTool('mcp__chrome-devtools__wait_for', {
        text,
        timeout,
      });

      logger.debug(`✓ 文本已出现`);
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.PAGE_OPERATION_FAILED,
        `等待文本失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 关闭页面
   */
  async closePage(pageIdx?: number): Promise<void> {
    try {
      const targetIdx = pageIdx ?? this.currentPage?.pageIdx;

      if (targetIdx === undefined) {
        throw new Error('未指定要关闭的页面');
      }

      await this.mcpClient.callTool('mcp__chrome-devtools__close_page', {
        pageIdx: targetIdx,
      });

      if (this.currentPage?.pageIdx === targetIdx) {
        this.currentPage = null;
      }

      logger.info(`✓ 页面已关闭 (索引: ${targetIdx})`);
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.PAGE_OPERATION_FAILED,
        `关闭页面失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 执行脚本
   */
  async evaluateScript<T = any>(
    script: string,
    args?: Array<{ uid: string }>
  ): Promise<T> {
    try {
      logger.debug('执行脚本');

      const result = await this.mcpClient.callTool('mcp__chrome-devtools__evaluate_script', {
        function: script,
        args,
      });

      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content.find((item: any) => item.type === 'text');
        if (textContent) {
          try {
            const parsed = JSON.parse(textContent.text);
            return parsed.result as T;
          } catch {
            return textContent.text as T;
          }
        }
      }

      return result as T;
    } catch (error) {
      throw new AutoSubError(
        ErrorCode.SCRIPT_EXECUTION_FAILED,
        `脚本执行失败: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * 获取当前页面
   */
  getCurrentPage(): MCPPage | null {
    return this.currentPage;
  }

  /**
   * 获取当前页面 URL
   */
  getCurrentUrl(): string {
    return this.currentPage?.url || '';
  }
}
