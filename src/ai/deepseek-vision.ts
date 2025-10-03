import axios from 'axios';
import { logger } from '../utils/logger.js';

/**
 * DeepSeek API 配置
 */
export interface DeepSeekConfig {
  apiUrl: string; // API 基础地址
  apiKey: string; // API 密钥
  model?: string; // 模型名称(可选)
}

/**
 * AI 识别结果
 */
export interface AIElementIdentification {
  found: boolean;
  description: string;
  selector?: string;
  confidence: number;
}

/**
 * DeepSeek AI 客户端
 * 用于智能识别页面元素（基于 DOM 结构分析）
 */
export class DeepSeekVisionClient {
  private config: DeepSeekConfig;

  constructor(config: DeepSeekConfig) {
    this.config = {
      ...config,
      model: config.model || 'deepseek-chat',
    };
  }

  /**
   * 分析页面 DOM,识别"复制订阅链接"按钮的选择器
   */
  async identifySubscriptionCopyButton(
    pageHTML: string,
    visibleButtons: Array<{ text: string; selector: string }>
  ): Promise<AIElementIdentification> {
    try {
      logger.info('🤖 使用 AI 分析 DOM 结构,识别"复制订阅链接"按钮...');

      // 构建精简的上下文
      const buttonsInfo = visibleButtons
        .map((btn, idx) => `${idx + 1}. 文本: "${btn.text}" | 选择器: ${btn.selector}`)
        .join('\n');

      const prompt = `你是一个专业的网页元素识别助手。请分析以下VPN订阅站点的可见按钮,找到用于"复制订阅链接"的按钮。

可见的按钮列表:
${buttonsInfo}

HTML片段(供参考):
${pageHTML.substring(0, 3000)}

要求:
1. **优先选择**: 包含"订阅"、"链接"、"复制"关键词的按钮
2. **必须排除**: 包含以下客户端名称的按钮:
   - Clash、Shadowrocket、Quantumult、Sing-Box、Surge
   - 或包含"导入"、"打开"等直接操作的按钮
3. 如果有多个符合条件的按钮,选择最可能是"通用复制链接"的那个
4. 返回按钮在上述列表中的编号

请严格按照以下JSON格式返回(不要有任何其他文字):
{
  "found": true,
  "description": "复制订阅链接按钮",
  "buttonNumber": 3,
  "confidence": 0.95
}

如果没找到合适的按钮:
{
  "found": false,
  "description": "未找到复制订阅链接按钮",
  "confidence": 0
}`;

      // 记录发送给AI的prompt (调试用,待删除)
      if (process.env.DEBUG_AI) {
        console.log('\n========== AI 输入 ==========');
        console.log(`按钮数量: ${visibleButtons.length}`);
        console.log(`按钮列表:\n${buttonsInfo}`);
        console.log(`Prompt前500字符:\n${prompt.substring(0, 500)}...\n`);
      }

      const response = await axios.post(
        `${this.config.apiUrl}/chat/completions`, // 构建完整的端点
        {
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content:
                '你是一个专业的网页元素识别助手。你的任务是准确识别VPN订阅站点中用于复制订阅链接的按钮,并排除直接导入到特定客户端的按钮。只返回JSON格式的结果,不要有其他文字。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 300,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          timeout: 30000,
        }
      );

      const result = this.parseAIResponse(response.data, visibleButtons);

      // 记录AI的输出 (调试用,待删除)
      if (process.env.DEBUG_AI) {
        console.log('\n========== AI 输出 ==========');
        const content = response.data.choices?.[0]?.message?.content || '';
        console.log('AI返回内容:', content);
        console.log(`解析结果: found=${result.found}, confidence=${result.confidence}`);
        console.log(`描述: ${result.description}`);
        if (result.selector) {
          console.log(`选择器: ${result.selector}`);
        }
        console.log('=================================\n');
      }

      if (result.found) {
        logger.info(`✓ AI 识别成功: ${result.description}`);
        logger.info(`  选择器: ${result.selector}`);
        logger.info(`  置信度: ${result.confidence}`);
      } else {
        logger.warn(`AI 未找到合适的按钮: ${result.description}`);
      }

      return result;
    } catch (error) {
      logger.error('AI 识别失败:', error);
      if (axios.isAxiosError(error)) {
        logger.error('API 响应:', error.response?.data);
      }
      return {
        found: false,
        description: 'AI 识别失败',
        confidence: 0,
      };
    }
  }

  /**
   * 解析 AI 响应
   */
  private parseAIResponse(
    responseData: any,
    visibleButtons: Array<{ text: string; selector: string }>
  ): AIElementIdentification {
    try {
      const content = responseData.choices?.[0]?.message?.content || '';
      logger.debug('AI 原始响应:', content);

      // 解析 JSON 响应
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        // 如果不是纯JSON,尝试提取JSON部分
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('无法解析 JSON');
        }
      }

      const found = parsed.found === true;
      const description = parsed.description || '';
      const confidence = parsed.confidence || 0;

      if (found && parsed.buttonNumber) {
        const buttonIndex = parsed.buttonNumber - 1;
        if (buttonIndex >= 0 && buttonIndex < visibleButtons.length) {
          return {
            found: true,
            description,
            selector: visibleButtons[buttonIndex].selector,
            confidence,
          };
        }
      }

      return {
        found: false,
        description: description || '未找到合适的按钮',
        confidence: 0,
      };
    } catch (error) {
      logger.error('解析 AI 响应失败:', error);
      return {
        found: false,
        description: '解析失败',
        confidence: 0,
      };
    }
  }
}
