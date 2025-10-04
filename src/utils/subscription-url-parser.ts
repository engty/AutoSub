/**
 * 订阅地址URL组件解析和构建工具
 *
 * 解决问题：订阅地址的IP、端口会动态变化，需要分开存储和动态更新
 *
 * 设计思路：
 * - protocol, path, tokenParam 固定（首次提取后不变）
 * - host, port, token 动态（从API响应更新）
 */

/**
 * 订阅地址URL组件
 */
export interface SubscriptionUrlComponents {
  protocol: string;      // 协议: "http" | "https"
  host: string;          // 主机: IP或域名
  port: string;          // 端口: "9000", "443" 等
  path: string;          // 路径: "/hxyunvip"
  tokenParam: string;    // token参数名: "token"
  token?: string;        // token值（可选，用于首次解析）
}

/**
 * 从完整的订阅地址URL解析出各个组件
 *
 * 支持两种格式：
 * 1. Query参数格式: https://host:port/path?token=xxx
 * 2. Path参数格式: https://host:port/path/sub/xxx (会被转换为格式1)
 *
 * @param url 完整的订阅地址URL
 * @returns URL组件对象
 * @throws 如果URL格式无效则抛出错误
 *
 * @example
 * parseSubscriptionUrl('https://43.139.213.75:9000/hxyunvip?token=abc123')
 * // => {
 * //   protocol: 'https',
 * //   host: '43.139.213.75',
 * //   port: '9000',
 * //   path: '/hxyunvip',
 * //   tokenParam: 'token',
 * //   token: 'abc123'
 * // }
 */
export function parseSubscriptionUrl(url: string): SubscriptionUrlComponents {
  try {
    const urlObj = new URL(url);

    // 提取token：优先从query参数提取
    let token = urlObj.searchParams.get('token') || undefined;
    let tokenParam = 'token';
    let path = urlObj.pathname;

    // 如果query中没有token，尝试从path提取（处理 /path/sub/xxx 格式）
    if (!token) {
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      if (pathParts.length > 0) {
        // 假设最后一段是token
        token = pathParts[pathParts.length - 1];
        // path去掉最后的token段
        path = '/' + pathParts.slice(0, -1).join('/');
      }
    }

    // 提取协议（去掉冒号）
    const protocol = urlObj.protocol.replace(':', '');

    // 提取端口（如果没有显式端口，使用默认端口）
    let port = urlObj.port;
    if (!port) {
      port = protocol === 'https' ? '443' : '80';
    }

    return {
      protocol,
      host: urlObj.hostname,
      port,
      path,
      tokenParam,
      token
    };
  } catch (error) {
    throw new Error(`无效的订阅地址URL: ${url}. 错误: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 从URL组件和token构建完整的订阅地址URL
 *
 * 始终使用query参数格式: https://host:port/path?tokenParam=token
 *
 * @param components URL组件
 * @param token token值（如果不提供，使用components中的token）
 * @returns 完整的订阅地址URL
 *
 * @example
 * buildSubscriptionUrl({
 *   protocol: 'https',
 *   host: '43.139.213.75',
 *   port: '9000',
 *   path: '/hxyunvip',
 *   tokenParam: 'token'
 * }, 'new_token_123')
 * // => 'https://43.139.213.75:9000/hxyunvip?token=new_token_123'
 */
export function buildSubscriptionUrl(
  components: SubscriptionUrlComponents,
  token?: string
): string {
  const { protocol, host, port, path, tokenParam } = components;
  const actualToken = token || components.token;

  if (!actualToken) {
    throw new Error('无法构建订阅地址：缺少token值');
  }

  // 标准端口不显示在URL中
  const shouldShowPort = !(
    (protocol === 'https' && port === '443') ||
    (protocol === 'http' && port === '80')
  );

  const portStr = shouldShowPort ? `:${port}` : '';

  // 确保path以/开头
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${protocol}://${host}${portStr}${normalizedPath}?${tokenParam}=${actualToken}`;
}

/**
 * 从API返回的完整订阅地址URL中提取host和port，更新到组件中
 *
 * 使用场景：
 * - API返回的订阅地址可能包含新的IP和端口
 * - 需要更新config中保存的host和port
 * - path和tokenParam保持不变
 *
 * @param components 当前的URL组件
 * @param apiUrl API返回的完整订阅地址URL
 * @returns 更新了host和port的新组件对象
 *
 * @example
 * const current = {
 *   protocol: 'https',
 *   host: '43.139.213.75',  // 旧IP
 *   port: '9000',
 *   path: '/hxyunvip',
 *   tokenParam: 'token'
 * };
 *
 * updateHostAndPort(current, 'https://50.100.200.300:8888/hxyunvip?token=xxx')
 * // => {
 * //   protocol: 'https',
 * //   host: '50.100.200.300',  // 新IP
 * //   port: '8888',             // 新端口
 * //   path: '/hxyunvip',        // 保持不变
 * //   tokenParam: 'token'       // 保持不变
 * // }
 */
export function updateHostAndPort(
  components: SubscriptionUrlComponents,
  apiUrl: string
): SubscriptionUrlComponents {
  try {
    const apiUrlObj = new URL(apiUrl);

    // 提取新的host和port
    let newPort = apiUrlObj.port;
    if (!newPort) {
      newPort = apiUrlObj.protocol === 'https:' ? '443' : '80';
    }

    // 返回更新后的组件（保持protocol, path, tokenParam不变）
    return {
      ...components,
      host: apiUrlObj.hostname,
      port: newPort
    };
  } catch (error) {
    // 如果解析失败，返回原组件（不更新）
    console.warn(`无法从API URL解析host和port: ${apiUrl}`, error);
    return components;
  }
}

/**
 * 检查URL组件配置是否完整有效
 *
 * @param components URL组件
 * @returns 是否有效
 */
export function isValidUrlComponents(components: Partial<SubscriptionUrlComponents>): components is SubscriptionUrlComponents {
  return !!(
    components.protocol &&
    components.host &&
    components.port &&
    components.path &&
    components.tokenParam
  );
}
