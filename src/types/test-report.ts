/**
 * 站点兼容性测试报告类型定义
 */

export interface TestReport {
  // 基本信息
  url: string;
  testTime: string;

  // 登录检测
  loginDetected: boolean;
  loginMethod?: string; // 'url' | 'element' | 'network' | 'cookie' | 'generic'
  loginDuration?: number; // 登录检测耗时（毫秒）

  // 凭证检测
  credentials: {
    cookies: {
      found: boolean;
      count: number;
      hasExpiry: boolean;
    };
    localStorage: {
      found: boolean;
      count: number;
      keys: string[];
    };
    sessionStorage: {
      found: boolean;
      count: number;
      keys: string[];
    };
  };

  // API 检测
  apiDetected: boolean;
  apiConfig?: {
    url: string;
    method: string;
    authSource: 'cookie' | 'localStorage' | 'both';
    authField?: string;
    tokenField?: string;
    subscribeUrlField?: string;
    subscriptionUrl?: {
      protocol: string;
      host: string;
      port: string;
      path: string;
      tokenParam: string;
    };
  };

  // 订阅地址提取
  subscriptionUrl?: string; // API提取的订阅地址
  clipboardSubscriptionUrl?: string; // 从剪贴板提取的正确订阅地址（基准）
  subscriptionExtracted: boolean;
  extractionMethod?: 'api' | 'clipboard' | 'network';
  urlTransformPattern?: {
    // URL转换规则（API地址 -> 正确地址）
    apiFormat: string; // API返回的格式
    correctFormat: string; // 正确的格式
    transformRule?: string; // 转换规则描述
  };

  // 订阅验证
  subscriptionValid?: boolean;
  subscriptionValidation?: {
    statusCode?: number;
    contentType?: string;
    isYaml?: boolean;
    nodeCount?: number;
    errorMessage?: string;
  };

  // 错误和警告
  errors: string[];
  warnings: string[];

  // 兼容性评估
  compatibility: {
    level: 'full' | 'partial' | 'none'; // 完全兼容 | 部分兼容 | 不兼容
    score: number; // 0-100
    canUseHttpApi: boolean; // 是否可以使用HTTP API模式
    canUseBrowserMode: boolean; // 是否可以使用浏览器模式
  };

  // 测试步骤详情
  steps: TestStep[];
}

export interface TestStep {
  name: string;
  status: 'success' | 'failed' | 'skipped';
  duration?: number; // 耗时（毫秒）
  message?: string;
  details?: any;
}

/**
 * AI格式化后的测试报告
 */
export interface FormattedTestReport {
  summary: string; // 总体结论
  details: string; // 详细说明（Markdown格式）
  recommendations: string[]; // 建议列表
  rawReport: TestReport; // 原始报告数据
}
