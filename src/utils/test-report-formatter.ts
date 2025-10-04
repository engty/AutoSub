import { TestReport, FormattedTestReport } from '../types/test-report.js';
import { AIConfig } from '../types/index.js';
import { getAIService, AIService } from '../ai/index.js';
import { logger } from './logger.js';

/**
 * 测试报告格式化工具
 * 使用AI将技术性的测试报告转换成用户友好的格式
 */
export class TestReportFormatter {
  constructor(private aiConfig?: AIConfig) {}

  /**
   * 格式化测试报告
   */
  async format(report: TestReport): Promise<FormattedTestReport> {
    // 如果没有AI配置，使用默认格式化
    if (!this.aiConfig || !this.aiConfig.enabled) {
      return this.formatWithoutAI(report);
    }

    try {
      // 使用AI格式化
      return await this.formatWithAI(report);
    } catch (error) {
      logger.warn('AI格式化失败，使用默认格式:', error);
      return this.formatWithoutAI(report);
    }
  }

  /**
   * 使用AI格式化报告
   */
  private async formatWithAI(report: TestReport): Promise<FormattedTestReport> {
    try {
      const aiService = getAIService();

      if (!aiService) {
        logger.warn('AI服务不可用，使用默认格式');
        return this.formatWithoutAI(report);
      }

      const prompt = this.buildAIPrompt(report);

      const response = await aiService.chat(prompt);

      // 解析AI响应
      const parsed = this.parseAIResponse(response);

      return {
        summary: parsed.summary,
        details: parsed.details,
        recommendations: parsed.recommendations,
        rawReport: report
      };
    } catch (error) {
      throw new Error(`AI格式化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 构建AI提示词
   */
  private buildAIPrompt(report: TestReport): string {
    return `你是一个专业的技术文档撰写助手。请将以下站点兼容性测试报告转换成用户友好的格式。

测试报告JSON:
\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`

请按照以下格式输出（使用JSON格式）:
{
  "summary": "一句话总结兼容性结论（例如：该站点完全兼容，可以正常使用）",
  "details": "详细的Markdown格式说明，包括：\\n1. 测试概况\\n2. 检测结果（登录、凭证、API、订阅验证）\\n3. 兼容性评估",
  "recommendations": ["建议1", "建议2", "建议3"]
}

要求：
1. summary要简洁明了，直接告诉用户能不能用
2. details使用Markdown格式，包含：
   - 测试站点和时间
   - 各项检测结果（使用emoji增强可读性：✅成功 ❌失败 ⚠️警告）
   - 兼容性等级和评分
   - 支持的模式（HTTP API / 浏览器模式）
3. recommendations根据测试结果给出实用建议
4. 如果有错误或警告，要在details中明确指出
5. 如果检测到API配置，要说明认证方式

直接返回JSON，不要包含其他内容。`;
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(response: string): {
    summary: string;
    details: string;
    recommendations: string[];
  } {
    try {
      // 尝试直接解析JSON
      const parsed = JSON.parse(response);
      return {
        summary: parsed.summary || '解析失败',
        details: parsed.details || '',
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
      };
    } catch {
      // 如果不是纯JSON，尝试提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || '解析失败',
          details: parsed.details || '',
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
        };
      }

      // 如果完全无法解析，返回原始响应
      return {
        summary: '无法解析AI响应',
        details: response,
        recommendations: []
      };
    }
  }

  /**
   * 不使用AI的默认格式化
   */
  private formatWithoutAI(report: TestReport): FormattedTestReport {
    const summary = this.generateSummary(report);
    const details = this.generateDetails(report);
    const recommendations = this.generateRecommendations(report);

    return {
      summary,
      details,
      recommendations,
      rawReport: report
    };
  }

  /**
   * 生成总结
   */
  private generateSummary(report: TestReport): string {
    const level = report.compatibility.level;
    const score = report.compatibility.score;

    if (level === 'full') {
      return `✅ 该站点完全兼容 Clash AutoSub（兼容性评分: ${score}/100）`;
    } else if (level === 'partial') {
      return `⚠️ 该站点部分兼容 Clash AutoSub（兼容性评分: ${score}/100），可能需要手动配置`;
    } else {
      return `❌ 该站点不兼容 Clash AutoSub（兼容性评分: ${score}/100）`;
    }
  }

  /**
   * 生成详细说明
   */
  private generateDetails(report: TestReport): string {
    const lines: string[] = [];

    // 测试概况
    lines.push('# 站点兼容性测试报告\n');
    lines.push(`**测试站点**: ${report.url}`);
    lines.push(`**测试时间**: ${new Date(report.testTime).toLocaleString('zh-CN')}`);
    lines.push(`**兼容性等级**: ${this.getLevelEmoji(report.compatibility.level)} ${this.getLevelText(report.compatibility.level)}`);
    lines.push(`**兼容性评分**: ${report.compatibility.score}/100`);

    return lines.join('\n');
  }

  /**
   * 生成建议
   */
  private generateRecommendations(report: TestReport): string[] {
    const recommendations: string[] = [];

    if (report.compatibility.level === 'full') {
      recommendations.push('该站点完全兼容，可以直接使用 `clash-autosub setup` 添加');
      if (report.compatibility.canUseHttpApi) {
        recommendations.push('支持HTTP API模式，后续更新将自动使用静默模式（< 1秒）');
      }
    } else if (report.compatibility.level === 'partial') {
      if (!report.apiDetected) {
        recommendations.push('未检测到API配置，建议手动配置或使用浏览器模式');
      }
      if (!report.subscriptionValid) {
        recommendations.push('订阅验证失败，请检查订阅地址是否正确');
      }
      recommendations.push('可以尝试添加该站点，但可能需要手动调整配置');
    } else {
      if (!report.loginDetected) {
        recommendations.push('登录检测失败，该站点可能使用特殊的登录方式');
      }
      if (!report.credentials.cookies.found && !report.credentials.localStorage.found) {
        recommendations.push('未检测到有效凭证，无法自动保持登录状态');
      }
      recommendations.push('建议在GitHub提交Issue，附上此测试报告');
    }

    return recommendations;
  }

  private getLevelEmoji(level: string): string {
    switch (level) {
      case 'full':
        return '🟢';
      case 'partial':
        return '🟡';
      case 'none':
        return '🔴';
      default:
        return '⚪';
    }
  }

  private getLevelText(level: string): string {
    switch (level) {
      case 'full':
        return '完全兼容';
      case 'partial':
        return '部分兼容';
      case 'none':
        return '不兼容';
      default:
        return '未知';
    }
  }
}
