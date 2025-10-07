# AutoSub Clash智能配置生成器 - 开发文档

## 📋 文档版本

| 版本 | 日期 | 作者 | 说明 |
|------|------|------|------|
| v1.0 | 2025-01-04 | AutoSub Team | 初始版本 |

---

## 🎯 项目目标

在AutoSub现有订阅地址采集功能基础上，增加**订阅内容解析 → 节点测速 → 智能分类 → Clash配置生成**的完整流程，实现全自动化的Clash配置文件管理。

### 核心价值

- ✅ **自动化**: 从订阅地址到可用Clash配置，全程自动化
- ✅ **智能化**: AI驱动的节点命名优化和分类
- ✅ **可靠性**: 节点测速过滤，只保留可用节点
- ✅ **易用性**: 一键生成，开箱即用

---

## 🏗️ 系统架构

### 整体流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                    AutoSub 现有功能                               │
│  • 自动登录VPN站点                                                │
│  • 提取订阅地址                                                   │
│  • 保存到 config.yaml                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  【新增】阶段1: 订阅内容下载与解析                                │
│                                                                   │
│  输入: 订阅地址 (URL)                                             │
│  处理:                                                            │
│    1. HTTP GET 请求下载订阅内容                                   │
│    2. 自动识别格式 (Clash YAML / Base64 / V2Ray JSON)           │
│    3. 解析节点列表，提取关键信息                                  │
│  输出: ProxyNode[] (节点数组)                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  【新增】阶段2: 节点可用性测试与测速                              │
│                                                                   │
│  输入: ProxyNode[] (待测节点)                                     │
│  处理:                                                            │
│    1. 并发HTTP延迟测试 (http://www.gstatic.com/generate_204)   │
│    2. 可用性检测 (过滤连接失败的节点)                             │
│    3. 延迟排序 (从快到慢)                                         │
│    4. [可选] 带宽测速 (Cloudflare/Speedtest.net)                │
│  输出: SpeedTestResult[] (测速结果)                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  【新增】阶段3: 节点智能分类与归档                                │
│                                                                   │
│  输入: ProxyNode[] + SpeedTestResult[]                          │
│  处理:                                                            │
│    1. 地区分类 (香港/新加坡/美国/日本/...)                        │
│    2. 速度分级 (高速<100ms / 中速<300ms / 低速>300ms)            │
│    3. 协议分类 (vmess/trojan/ss/ssr)                             │
│    4. [可选] AI节点命名优化                                       │
│  输出: 分类后的节点组                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  【新增】阶段4: Clash配置文件生成                                 │
│                                                                   │
│  输入: 分类后的节点组                                             │
│  处理:                                                            │
│    1. 合并所有站点的可用节点                                      │
│    2. 生成策略组 (自动选择/手动选择/故障转移/负载均衡)             │
│    3. 配置规则集 (去广告/流媒体分流/国内直连)                      │
│    4. 生成完整 Clash YAML 配置                                    │
│  输出: clash.yaml 配置文件                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 技术架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户命令层                                │
│  CLI: autosub clash:generate [options]                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        业务逻辑层                                 │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ SubscriptionParser│  │ NodeSpeedTester  │  │NodeClassifier│  │
│  │  订阅解析器        │  │   节点测速器      │  │  节点分类器   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              ClashConfigGenerator                         │  │
│  │              Clash配置生成器                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        工具/服务层                                │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  axios   │  │ js-yaml  │  │  logger  │  │  AI Service  │   │
│  │ HTTP客户端│  │ YAML解析 │  │  日志     │  │  AI增强      │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 核心模块设计

### 模块1: 订阅内容解析器 (SubscriptionParser)

#### 功能描述

将订阅地址返回的内容解析为统一的节点数据结构。

#### 核心接口

```typescript
// src/subscription/subscription-parser.ts

/**
 * 节点信息接口（统一数据结构）
 */
export interface ProxyNode {
  name: string;           // 节点名称
  type: string;           // 协议类型: vmess/trojan/ss/ssr/http/socks5
  server: string;         // 服务器地址
  port: number;           // 端口号

  // 认证信息
  password?: string;      // 密码 (ss/ssr/http)
  uuid?: string;          // UUID (vmess/trojan)

  // 加密与协议
  cipher?: string;        // 加密方式 (ss/ssr)
  protocol?: string;      // 协议 (ssr)

  // 传输层配置
  network?: string;       // 传输协议: tcp/ws/grpc/h2
  tls?: boolean;          // 是否启用TLS
  sni?: string;           // SNI域名

  // VMess特有
  alterId?: number;       // VMess alterId

  // WebSocket配置
  wsPath?: string;        // WebSocket路径
  wsHeaders?: Record<string, string>; // WebSocket请求头

  // 其他元数据
  udp?: boolean;          // 是否支持UDP
  skipCertVerify?: boolean; // 是否跳过证书验证
}

/**
 * 订阅解析结果
 */
export interface ParseResult {
  format: 'clash' | 'base64' | 'v2ray' | 'unknown';
  nodes: ProxyNode[];
  originalConfig?: any;    // 原始配置（用于高级用户）
  parseTime: Date;
  totalNodes: number;
}

/**
 * 订阅内容解析器
 */
export class SubscriptionParser {

  /**
   * 主入口：解析订阅内容
   * @param subscriptionContent - 订阅地址返回的原始内容
   * @returns 解析结果
   */
  async parse(subscriptionContent: string): Promise<ParseResult>;

  /**
   * 格式检测
   */
  private detectFormat(content: string): ParseResult['format'];

  /**
   * 解析Clash YAML格式
   */
  private parseClashYAML(content: string): ParseResult;

  /**
   * 解析Base64编码格式
   */
  private parseBase64(content: string): ParseResult;

  /**
   * 解析V2Ray JSON格式
   */
  private parseV2RayJSON(content: string): ParseResult;

  /**
   * 解析VMess URI
   */
  private parseVMessURI(uri: string): ProxyNode;

  /**
   * 解析Trojan URI
   */
  private parseTrojanURI(uri: string): ProxyNode;

  /**
   * 解析Shadowsocks URI
   */
  private parseSSURI(uri: string): ProxyNode;

  /**
   * 解析ShadowsocksR URI
   */
  private parseSSRURI(uri: string): ProxyNode;
}
```

#### 支持的订阅格式

| 格式 | 识别特征 | 解析方法 | 优先级 |
|------|---------|---------|-------|
| Clash YAML | `proxies:` 或 `proxy-groups:` | js-yaml解析 | 高 |
| Base64编码 | 纯Base64字符串 | 解码后按行分割URI | 中 |
| V2Ray JSON | `{"outbounds":...}` | JSON.parse | 中 |

#### 实现细节

##### 1. 格式检测逻辑

```typescript
private detectFormat(content: string): ParseResult['format'] {
  // 去除首尾空格
  const trimmed = content.trim();

  // 优先级1: Clash YAML格式
  if (trimmed.includes('proxies:') || trimmed.includes('proxy-groups:')) {
    return 'clash';
  }

  // 优先级2: Base64编码
  // 特征: 只包含 A-Za-z0-9+/= 字符，且长度足够长
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length > 50) {
    return 'base64';
  }

  // 优先级3: V2Ray JSON
  try {
    const json = JSON.parse(trimmed);
    if (json.outbounds || json.vnext || json.inbounds) {
      return 'v2ray';
    }
  } catch {
    // 不是JSON，继续检测
  }

  return 'unknown';
}
```

##### 2. Clash YAML解析

```typescript
private parseClashYAML(content: string): ParseResult {
  const config = yaml.load(content) as any;

  if (!config.proxies || !Array.isArray(config.proxies)) {
    throw new Error('无效的Clash配置：缺少proxies字段');
  }

  const nodes: ProxyNode[] = config.proxies.map((proxy: any) => ({
    name: proxy.name,
    type: proxy.type,
    server: proxy.server,
    port: proxy.port,
    password: proxy.password,
    uuid: proxy.uuid,
    cipher: proxy.cipher,
    network: proxy.network,
    tls: proxy.tls,
    sni: proxy.sni,
    wsPath: proxy['ws-path'] || proxy['ws-opts']?.path,
    wsHeaders: proxy['ws-headers'] || proxy['ws-opts']?.headers,
    alterId: proxy.alterId,
    udp: proxy.udp,
    skipCertVerify: proxy['skip-cert-verify'],
  }));

  return {
    format: 'clash',
    nodes,
    originalConfig: config,
    parseTime: new Date(),
    totalNodes: nodes.length
  };
}
```

##### 3. Base64解析

```typescript
private parseBase64(content: string): ParseResult {
  // 解码Base64
  const decoded = Buffer.from(content.trim(), 'base64').toString('utf-8');

  // 按行分割
  const lines = decoded.split('\n').filter(line => line.trim());

  const nodes: ProxyNode[] = [];

  for (const line of lines) {
    try {
      // 根据URI协议头分发到对应解析器
      if (line.startsWith('vmess://')) {
        nodes.push(this.parseVMessURI(line));
      } else if (line.startsWith('trojan://')) {
        nodes.push(this.parseTrojanURI(line));
      } else if (line.startsWith('ss://')) {
        nodes.push(this.parseSSURI(line));
      } else if (line.startsWith('ssr://')) {
        nodes.push(this.parseSSRURI(line));
      }
    } catch (error) {
      logger.warn(`解析节点失败: ${line.substring(0, 50)}...`, error);
    }
  }

  return {
    format: 'base64',
    nodes,
    parseTime: new Date(),
    totalNodes: nodes.length
  };
}
```

##### 4. VMess URI解析

```typescript
private parseVMessURI(uri: string): ProxyNode {
  // vmess://Base64EncodedJSON
  const base64Content = uri.replace('vmess://', '');
  const jsonStr = Buffer.from(base64Content, 'base64').toString('utf-8');
  const config = JSON.parse(jsonStr);

  return {
    name: config.ps || config.name || `${config.add}:${config.port}`,
    type: 'vmess',
    server: config.add,
    port: parseInt(config.port),
    uuid: config.id,
    alterId: parseInt(config.aid || '0'),
    cipher: config.scy || 'auto',
    network: config.net || 'tcp',
    tls: config.tls === 'tls',
    sni: config.sni || config.host,
    wsPath: config.path,
    wsHeaders: config.host ? { Host: config.host } : undefined,
  };
}
```

##### 5. Trojan URI解析

```typescript
private parseTrojanURI(uri: string): ProxyNode {
  // trojan://password@server:port?sni=xxx&type=ws&path=/path#NodeName
  const url = new URL(uri);

  return {
    name: decodeURIComponent(url.hash.substring(1)) || `${url.hostname}:${url.port}`,
    type: 'trojan',
    server: url.hostname,
    port: parseInt(url.port),
    password: url.username,
    sni: url.searchParams.get('sni') || url.hostname,
    network: url.searchParams.get('type') || 'tcp',
    wsPath: url.searchParams.get('path') || undefined,
    tls: true, // Trojan协议强制TLS
    skipCertVerify: url.searchParams.get('allowInsecure') === '1',
  };
}
```

---

### 模块2: 节点测速器 (NodeSpeedTester)

#### 功能描述

对解析出的节点进行可用性测试和延迟测速，过滤不可用节点。

#### 核心接口

```typescript
// src/subscription/node-speedtest.ts

/**
 * 测速结果
 */
export interface SpeedTestResult {
  nodeName: string;
  delay: number;           // 延迟(ms) -1表示不可用
  bandwidth?: number;      // 带宽(MB/s) 仅高级测速
  jitter?: number;         // 抖动(ms) 仅高级测速
  available: boolean;      // 是否可用
  testTime: Date;
  errorMessage?: string;   // 错误信息（不可用时）
}

/**
 * 测速配置
 */
export interface SpeedTestOptions {
  timeout?: number;        // 超时时间(ms) 默认5000
  concurrency?: number;    // 并发数 默认10
  testUrl?: string;        // 测试URL 默认Google 204
  retries?: number;        // 重试次数 默认0
}

/**
 * 节点测速器
 */
export class NodeSpeedTester {

  /**
   * 测试单个节点
   */
  async testNode(
    node: ProxyNode,
    options?: SpeedTestOptions
  ): Promise<SpeedTestResult>;

  /**
   * 批量测试节点（带并发控制）
   */
  async testNodes(
    nodes: ProxyNode[],
    options?: SpeedTestOptions
  ): Promise<SpeedTestResult[]>;

  /**
   * 过滤可用节点
   */
  filterAvailableNodes(
    nodes: ProxyNode[],
    results: SpeedTestResult[]
  ): ProxyNode[];

  /**
   * 按延迟排序
   */
  sortByDelay(results: SpeedTestResult[]): SpeedTestResult[];
}
```

#### 实现策略

##### 策略1: HTTP 204延迟测试（推荐）

**优点**: 轻量、无依赖、跨平台
**缺点**: 仅能测延迟，无法测带宽

```typescript
async testNode(node: ProxyNode, options?: SpeedTestOptions): Promise<SpeedTestResult> {
  const testUrl = options?.testUrl || 'http://www.gstatic.com/generate_204';
  const timeout = options?.timeout || 5000;

  const startTime = Date.now();

  try {
    // 注意: 对于vmess/trojan等复杂协议，需要先启动Clash代理
    // 简单协议(http/socks5/ss)可以直接使用代理Agent

    const response = await axios.get(testUrl, {
      timeout,
      validateStatus: (status) => status === 204 || status === 200,
    });

    const delay = Date.now() - startTime;

    return {
      nodeName: node.name,
      delay,
      available: true,
      testTime: new Date()
    };

  } catch (error) {
    return {
      nodeName: node.name,
      delay: -1,
      available: false,
      testTime: new Date(),
      errorMessage: error.message
    };
  }
}
```

##### 策略2: Clash Meta API测速（高级）

**优点**: 支持所有协议、准确
**缺点**: 需要启动Clash进程

```typescript
async testWithClashMeta(nodes: ProxyNode[]): Promise<SpeedTestResult[]> {
  // 1. 生成临时Clash配置
  const tempConfig = this.generateTempClashConfig(nodes);
  const configPath = '/tmp/autosub-test-config.yaml';
  fs.writeFileSync(configPath, yaml.dump(tempConfig));

  // 2. 启动Clash Meta进程
  const clashProcess = spawn('clash-meta', ['-f', configPath, '-d', '/tmp/clash-test']);

  // 等待Clash启动
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // 3. 通过Clash API测速
    const results: SpeedTestResult[] = [];

    for (const node of nodes) {
      const result = await axios.get(`http://127.0.0.1:9090/proxies/${node.name}/delay`, {
        params: {
          url: 'http://www.gstatic.com/generate_204',
          timeout: 5000
        }
      });

      results.push({
        nodeName: node.name,
        delay: result.data.delay,
        available: result.data.delay > 0,
        testTime: new Date()
      });
    }

    return results;

  } finally {
    // 4. 关闭Clash进程
    clashProcess.kill();
  }
}
```

#### 并发控制实现

```typescript
async testNodes(
  nodes: ProxyNode[],
  options?: SpeedTestOptions
): Promise<SpeedTestResult[]> {

  const concurrency = options?.concurrency || 10;
  const results: SpeedTestResult[] = [];

  logger.info(`开始测速 ${nodes.length} 个节点 (并发: ${concurrency})`);

  // 分批并发测试
  for (let i = 0; i < nodes.length; i += concurrency) {
    const batch = nodes.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(node => this.testNode(node, options))
    );

    results.push(...batchResults);

    const progress = Math.round((results.length / nodes.length) * 100);
    logger.info(`测速进度: ${results.length}/${nodes.length} (${progress}%)`);
  }

  // 按延迟排序
  return this.sortByDelay(results);
}

sortByDelay(results: SpeedTestResult[]): SpeedTestResult[] {
  return results.sort((a, b) => {
    // 不可用节点排到最后
    if (!a.available) return 1;
    if (!b.available) return -1;

    // 按延迟升序排序
    return a.delay - b.delay;
  });
}
```

---

### 模块3: 节点分类器 (NodeClassifier)

#### 功能描述

将节点按地区、速度、协议等维度分类，便于生成策略组。

#### 核心接口

```typescript
// src/subscription/node-classifier.ts

/**
 * 节点分类器
 */
export class NodeClassifier {

  /**
   * 按地区分组
   */
  classifyByRegion(nodes: ProxyNode[]): Map<string, ProxyNode[]>;

  /**
   * 按速度分级
   */
  classifyBySpeed(
    nodes: ProxyNode[],
    speedResults: SpeedTestResult[]
  ): {
    highSpeed: ProxyNode[];    // <100ms
    mediumSpeed: ProxyNode[];  // 100-300ms
    lowSpeed: ProxyNode[];     // >300ms
  };

  /**
   * 按协议分类
   */
  classifyByProtocol(nodes: ProxyNode[]): Map<string, ProxyNode[]>;

  /**
   * AI优化节点命名
   */
  async optimizeNodeNames(nodes: ProxyNode[]): Promise<ProxyNode[]>;

  /**
   * 检测节点地区
   */
  private detectRegion(nodeName: string): string;
}
```

#### 地区检测实现

```typescript
private detectRegion(nodeName: string): string {
  // 地区关键词映射表
  const regionKeywords: Record<string, string[]> = {
    '香港': ['香港', 'HK', 'Hong Kong', 'HongKong', '港', 'HGC', 'HKBN', 'PCCW'],
    '台湾': ['台湾', 'TW', 'Taiwan', '台', 'CHT', 'Hinet'],
    '新加坡': ['新加坡', 'SG', 'Singapore', '狮城', '坡'],
    '日本': ['日本', 'JP', 'Japan', '东京', 'Tokyo', '大阪', 'Osaka'],
    '韩国': ['韩国', 'KR', 'Korea', '首尔', 'Seoul'],
    '美国': ['美国', 'US', 'USA', 'America', '洛杉矶', 'LA', '西雅图', 'Seattle', '纽约', 'NY'],
    '英国': ['英国', 'UK', 'Britain', '伦敦', 'London'],
    '德国': ['德国', 'DE', 'Germany', '法兰克福', 'Frankfurt'],
    '法国': ['法国', 'FR', 'France', '巴黎', 'Paris'],
    '加拿大': ['加拿大', 'CA', 'Canada', '多伦多', 'Toronto'],
    '澳大利亚': ['澳大利亚', 'AU', 'Australia', '悉尼', 'Sydney'],
    '俄罗斯': ['俄罗斯', 'RU', 'Russia', '莫斯科', 'Moscow'],
    '印度': ['印度', 'IN', 'India', '孟买', 'Mumbai'],
    '巴西': ['巴西', 'BR', 'Brazil', '圣保罗', 'Sao Paulo'],
    '土耳其': ['土耳其', 'TR', 'Turkey', '伊斯坦布尔', 'Istanbul'],
    '阿根廷': ['阿根廷', 'AR', 'Argentina'],
  };

  // 检测匹配
  for (const [region, keywords] of Object.entries(regionKeywords)) {
    for (const keyword of keywords) {
      if (nodeName.includes(keyword)) {
        return region;
      }
    }
  }

  return '其他';
}

classifyByRegion(nodes: ProxyNode[]): Map<string, ProxyNode[]> {
  const regionMap = new Map<string, ProxyNode[]>();

  for (const node of nodes) {
    const region = this.detectRegion(node.name);

    if (!regionMap.has(region)) {
      regionMap.set(region, []);
    }

    regionMap.get(region)!.push(node);
  }

  // 按节点数量排序
  return new Map(
    Array.from(regionMap.entries())
      .sort((a, b) => b[1].length - a[1].length)
  );
}
```

#### 速度分级实现

```typescript
classifyBySpeed(
  nodes: ProxyNode[],
  speedResults: SpeedTestResult[]
): {
  highSpeed: ProxyNode[];
  mediumSpeed: ProxyNode[];
  lowSpeed: ProxyNode[];
} {
  // 构建延迟映射表
  const delayMap = new Map(
    speedResults.map(r => [r.nodeName, r.delay])
  );

  const highSpeed: ProxyNode[] = [];
  const mediumSpeed: ProxyNode[] = [];
  const lowSpeed: ProxyNode[] = [];

  for (const node of nodes) {
    const delay = delayMap.get(node.name);

    // 跳过不可用节点
    if (!delay || delay < 0) continue;

    if (delay < 100) {
      highSpeed.push(node);
    } else if (delay < 300) {
      mediumSpeed.push(node);
    } else {
      lowSpeed.push(node);
    }
  }

  return { highSpeed, mediumSpeed, lowSpeed };
}
```

#### AI节点命名优化

```typescript
async optimizeNodeNames(nodes: ProxyNode[]): Promise<ProxyNode[]> {
  const aiService = getAIService();
  if (!aiService) {
    logger.warn('AI未启用，跳过节点命名优化');
    return nodes;
  }

  // 限制优化数量，避免API调用过多
  const sampleSize = Math.min(nodes.length, 50);
  const sampleNodes = nodes.slice(0, sampleSize);

  const prompt = `优化VPN节点命名，使其更清晰易读：

原始节点名（前${sampleSize}个）:
${sampleNodes.map((n, i) => `${i+1}. ${n.name}`).join('\n')}

优化规则:
1. 统一格式：地区 + [线路类型] + 编号
2. 中文优先，保留关键英文缩写(IPLC/IEPL)
3. 去除多余符号和emoji
4. 线路类型: IPLC(国际专线) / BGP(普通) / CN2(电信优化)

示例:
- "🇭🇰HK-IPLC-01 [100Mbps]" → "香港 IPLC 01"
- "SG_Premium_Node_2" → "新加坡 BGP 02"

返回JSON数组:
[
  {"old": "原始名称", "new": "优化后名称"},
  ...
]`;

  try {
    const result = await aiService.chat(prompt);
    const mappings = JSON.parse(result);

    // 应用命名映射
    return nodes.map(node => {
      const mapping = mappings.find((m: any) => m.old === node.name);
      if (mapping) {
        logger.debug(`节点重命名: ${node.name} → ${mapping.new}`);
        return { ...node, name: mapping.new };
      }
      return node;
    });

  } catch (error) {
    logger.error('AI节点命名优化失败:', error);
    return nodes; // 失败时返回原始节点
  }
}
```

---

### 模块4: Clash配置生成器 (ClashConfigGenerator)

#### 功能描述

将分类后的节点生成完整的Clash配置文件。

#### 核心接口

```typescript
// src/subscription/clash-config-generator.ts

/**
 * Clash配置生成选项
 */
export interface ClashConfigOptions {
  mode?: 'rule' | 'global' | 'direct';      // 运行模式
  port?: number;                             // HTTP代理端口
  socksPort?: number;                        // SOCKS5代理端口
  allowLan?: boolean;                        // 允许局域网连接
  logLevel?: 'info' | 'warning' | 'error' | 'debug' | 'silent';

  // 策略组配置
  enableAutoSelect?: boolean;                // 启用自动选择
  enableLoadBalance?: boolean;               // 启用负载均衡
  enableFallback?: boolean;                  // 启用故障转移

  // 规则配置
  enableAdBlock?: boolean;                   // 启用广告拦截
  enableStreamingRules?: boolean;            // 启用流媒体分流
  enableChinaDirect?: boolean;               // 启用国内直连

  // 高级选项
  dns?: any;                                 // DNS配置
  customRules?: string[];                    // 自定义规则
}

/**
 * Clash配置生成器
 */
export class ClashConfigGenerator {

  /**
   * 生成完整Clash配置
   */
  async generate(
    allNodes: ProxyNode[],
    speedResults: SpeedTestResult[],
    options?: ClashConfigOptions
  ): Promise<string>;

  /**
   * 生成策略组
   */
  private generateProxyGroups(
    regionGroups: Map<string, ProxyNode[]>,
    speedGroups: any,
    options?: ClashConfigOptions
  ): any[];

  /**
   * 生成规则
   */
  private generateRules(options?: ClashConfigOptions): string[];

  /**
   * 获取地区Emoji
   */
  private getRegionEmoji(region: string): string;
}
```

#### 配置生成实现

```typescript
async generate(
  allNodes: ProxyNode[],
  speedResults: SpeedTestResult[],
  options?: ClashConfigOptions
): Promise<string> {

  logger.info(`开始生成Clash配置，共 ${allNodes.length} 个节点`);

  // 1. 过滤可用节点
  const availableNodes = allNodes.filter(node => {
    const result = speedResults.find(r => r.nodeName === node.name);
    return result?.available === true;
  });

  logger.info(`可用节点: ${availableNodes.length}/${allNodes.length}`);

  if (availableNodes.length === 0) {
    throw new Error('没有可用节点，无法生成配置');
  }

  // 2. 节点分类
  const classifier = new NodeClassifier();
  const regionGroups = classifier.classifyByRegion(availableNodes);
  const speedGroups = classifier.classifyBySpeed(availableNodes, speedResults);

  // 3. 构建Clash配置对象
  const clashConfig: any = {
    // 基础配置
    port: options?.port || 7890,
    'socks-port': options?.socksPort || 7891,
    'allow-lan': options?.allowLan || false,
    mode: options?.mode || 'rule',
    'log-level': options?.logLevel || 'info',
    'external-controller': '127.0.0.1:9090',

    // DNS配置
    dns: options?.dns || {
      enable: true,
      ipv6: false,
      'enhanced-mode': 'fake-ip',
      nameserver: [
        '223.5.5.5',
        '119.29.29.29'
      ],
      fallback: [
        'https://1.1.1.1/dns-query',
        'https://dns.google/dns-query'
      ]
    },

    // 代理节点
    proxies: availableNodes,

    // 策略组
    'proxy-groups': this.generateProxyGroups(regionGroups, speedGroups, options),

    // 规则
    rules: this.generateRules(options),
  };

  // 4. 转换为YAML
  const yamlContent = yaml.dump(clashConfig, {
    indent: 2,
    lineWidth: -1,
    noRefs: true
  });

  logger.info('Clash配置生成成功');

  return yamlContent;
}
```

#### 策略组生成

```typescript
private generateProxyGroups(
  regionGroups: Map<string, ProxyNode[]>,
  speedGroups: any,
  options?: ClashConfigOptions
): any[] {

  const groups: any[] = [];

  // 1. 主选择组
  const mainProxies = [
    'DIRECT',
    '♻️ 自动选择',
  ];

  // 添加地区组
  for (const region of regionGroups.keys()) {
    const emoji = this.getRegionEmoji(region);
    mainProxies.push(`${emoji} ${region}`);
  }

  // 添加速度组
  if (speedGroups.highSpeed.length > 0) {
    mainProxies.push('⚡ 高速节点');
  }

  groups.push({
    name: '🚀 节点选择',
    type: 'select',
    proxies: mainProxies
  });

  // 2. 自动选择组（基于延迟）
  if (options?.enableAutoSelect !== false) {
    const autoNodes = speedGroups.highSpeed.length > 0
      ? speedGroups.highSpeed
      : speedGroups.mediumSpeed;

    if (autoNodes.length > 0) {
      groups.push({
        name: '♻️ 自动选择',
        type: 'url-test',
        proxies: autoNodes.map((n: ProxyNode) => n.name),
        url: 'http://www.gstatic.com/generate_204',
        interval: 300,
        tolerance: 50
      });
    }
  }

  // 3. 负载均衡组
  if (options?.enableLoadBalance && speedGroups.highSpeed.length > 2) {
    groups.push({
      name: '⚖️ 负载均衡',
      type: 'load-balance',
      proxies: speedGroups.highSpeed.map((n: ProxyNode) => n.name),
      url: 'http://www.gstatic.com/generate_204',
      interval: 300
    });
  }

  // 4. 故障转移组
  if (options?.enableFallback && speedGroups.highSpeed.length > 1) {
    groups.push({
      name: '🔄 故障转移',
      type: 'fallback',
      proxies: speedGroups.highSpeed.map((n: ProxyNode) => n.name),
      url: 'http://www.gstatic.com/generate_204',
      interval: 300
    });
  }

  // 5. 高速节点组
  if (speedGroups.highSpeed.length > 0) {
    groups.push({
      name: '⚡ 高速节点',
      type: 'select',
      proxies: speedGroups.highSpeed.map((n: ProxyNode) => n.name)
    });
  }

  // 6. 地区分组
  for (const [region, nodes] of regionGroups) {
    const emoji = this.getRegionEmoji(region);

    groups.push({
      name: `${emoji} ${region}`,
      type: 'select',
      proxies: nodes.map(n => n.name)
    });
  }

  // 7. 流媒体分组
  if (options?.enableStreamingRules !== false) {
    groups.push({
      name: '📺 流媒体',
      type: 'select',
      proxies: ['🚀 节点选择', ...mainProxies.slice(2)]
    });
  }

  // 8. 广告拦截
  if (options?.enableAdBlock !== false) {
    groups.push({
      name: '🛡️ 广告拦截',
      type: 'select',
      proxies: ['REJECT', 'DIRECT']
    });
  }

  // 9. 国内直连
  groups.push({
    name: '🎯 国内直连',
    type: 'select',
    proxies: ['DIRECT', '🚀 节点选择']
  });

  // 10. 漏网之鱼
  groups.push({
    name: '🐟 漏网之鱼',
    type: 'select',
    proxies: ['🚀 节点选择', 'DIRECT']
  });

  return groups;
}
```

#### 规则生成

```typescript
private generateRules(options?: ClashConfigOptions): string[] {
  const rules: string[] = [];

  // 1. 广告拦截规则
  if (options?.enableAdBlock !== false) {
    rules.push(
      // Google广告
      'DOMAIN-SUFFIX,googlesyndication.com,🛡️ 广告拦截',
      'DOMAIN-SUFFIX,googleadservices.com,🛡️ 广告拦截',
      'DOMAIN-SUFFIX,doubleclick.net,🛡️ 广告拦截',

      // Facebook广告
      'DOMAIN-SUFFIX,facebook.com,🛡️ 广告拦截',
      'DOMAIN-SUFFIX,fbcdn.net,🛡️ 广告拦截',

      // 国内广告
      'DOMAIN-SUFFIX,tanx.com,🛡️ 广告拦截',
      'DOMAIN-SUFFIX,mmstat.com,🛡️ 广告拦截'
    );
  }

  // 2. 流媒体分流规则
  if (options?.enableStreamingRules !== false) {
    rules.push(
      // YouTube
      'DOMAIN-SUFFIX,youtube.com,📺 流媒体',
      'DOMAIN-SUFFIX,googlevideo.com,📺 流媒体',
      'DOMAIN-SUFFIX,ytimg.com,📺 流媒体',

      // Netflix
      'DOMAIN-SUFFIX,netflix.com,📺 流媒体',
      'DOMAIN-SUFFIX,nflxvideo.net,📺 流媒体',

      // Disney+
      'DOMAIN-SUFFIX,disneyplus.com,📺 流媒体',
      'DOMAIN-SUFFIX,disney-plus.net,📺 流媒体',

      // Spotify
      'DOMAIN-SUFFIX,spotify.com,📺 流媒体',
      'DOMAIN-SUFFIX,scdn.co,📺 流媒体'
    );
  }

  // 3. 国内直连规则
  if (options?.enableChinaDirect !== false) {
    rules.push(
      // 国内域名
      'DOMAIN-SUFFIX,cn,🎯 国内直连',
      'DOMAIN-KEYWORD,baidu,🎯 国内直连',
      'DOMAIN-KEYWORD,taobao,🎯 国内直连',
      'DOMAIN-KEYWORD,alipay,🎯 国内直连',

      // GeoIP中国
      'GEOIP,CN,🎯 国内直连'
    );
  }

  // 4. 自定义规则
  if (options?.customRules && options.customRules.length > 0) {
    rules.push(...options.customRules);
  }

  // 5. 局域网直连
  rules.push(
    'IP-CIDR,192.168.0.0/16,DIRECT',
    'IP-CIDR,10.0.0.0/8,DIRECT',
    'IP-CIDR,172.16.0.0/12,DIRECT',
    'IP-CIDR,127.0.0.0/8,DIRECT'
  );

  // 6. 最终规则
  rules.push('MATCH,🐟 漏网之鱼');

  return rules;
}
```

#### 地区Emoji映射

```typescript
private getRegionEmoji(region: string): string {
  const emojiMap: Record<string, string> = {
    '香港': '🇭🇰',
    '台湾': '🇨🇳',
    '新加坡': '🇸🇬',
    '日本': '🇯🇵',
    '韩国': '🇰🇷',
    '美国': '🇺🇸',
    '英国': '🇬🇧',
    '德国': '🇩🇪',
    '法国': '🇫🇷',
    '加拿大': '🇨🇦',
    '澳大利亚': '🇦🇺',
    '俄罗斯': '🇷🇺',
    '印度': '🇮🇳',
    '巴西': '🇧🇷',
    '土耳其': '🇹🇷',
    '阿根廷': '🇦🇷',
    '其他': '🌍'
  };

  return emojiMap[region] || '🌍';
}
```

---

## 🔧 CLI命令设计

### 命令1: 生成Clash配置

```bash
autosub clash:generate [options]
```

**选项**:

```
--output, -o <path>      输出文件路径 (默认: ~/.autosub/clash.yaml)
--test-speed             是否测速 (默认: true)
--concurrency <num>      测速并发数 (默认: 10)
--timeout <ms>           测速超时时间 (默认: 5000ms)
--no-ai                  禁用AI命名优化
--mode <rule|global>     Clash运行模式 (默认: rule)
--port <num>             HTTP代理端口 (默认: 7890)
--enable-adblock         启用广告拦截规则
--enable-streaming       启用流媒体分流规则
```

**示例**:

```bash
# 基础生成
autosub clash:generate

# 自定义输出路径
autosub clash:generate -o ~/clash-config.yaml

# 禁用测速（快速生成）
autosub clash:generate --no-test-speed

# 启用所有高级功能
autosub clash:generate --enable-adblock --enable-streaming --concurrency 20
```

### 命令2: 测速所有节点

```bash
autosub clash:speedtest [options]
```

**选项**:

```
--output, -o <path>      输出测速结果JSON
--concurrency <num>      并发数
--format <json|csv>      输出格式
```

**示例**:

```bash
# 测速并保存结果
autosub clash:speedtest -o speedtest-results.json

# CSV格式输出
autosub clash:speedtest --format csv -o results.csv
```

### 命令3: 解析订阅地址

```bash
autosub clash:parse <subscription-url> [options]
```

**选项**:

```
--output, -o <path>      输出解析结果
--format <json|yaml>     输出格式
```

**示例**:

```bash
# 解析单个订阅地址
autosub clash:parse https://example.com/sub?token=xxx

# 输出为JSON
autosub clash:parse https://example.com/sub?token=xxx --format json -o nodes.json
```

---

## 📁 文件结构

```
AutoSub/
├── src/
│   ├── subscription/
│   │   ├── subscription-parser.ts       # 订阅解析器
│   │   ├── node-speedtest.ts            # 节点测速器
│   │   ├── node-classifier.ts           # 节点分类器
│   │   └── clash-config-generator.ts    # Clash配置生成器
│   ├── cli/
│   │   └── clash-commands.ts            # Clash相关CLI命令
│   └── types/
│       └── clash.ts                     # Clash相关类型定义
├── docs/
│   └── CLASH_CONFIG_GENERATOR.md        # 本文档
└── test/
    └── subscription/
        ├── parser.test.ts
        ├── speedtest.test.ts
        ├── classifier.test.ts
        └── generator.test.ts
```

---

## 🧪 测试计划

### 单元测试

#### 1. SubscriptionParser测试

```typescript
describe('SubscriptionParser', () => {
  it('应该正确检测Clash YAML格式', () => {
    const parser = new SubscriptionParser();
    const format = parser['detectFormat']('proxies:\n  - name: test');
    expect(format).toBe('clash');
  });

  it('应该正确解析VMess URI', () => {
    const parser = new SubscriptionParser();
    const uri = 'vmess://eyJhZGQiOiIxLjIuMy40IiwicG9ydCI6NDQzfQ==';
    const node = parser['parseVMessURI'](uri);
    expect(node.type).toBe('vmess');
    expect(node.server).toBe('1.2.3.4');
  });

  it('应该处理格式错误', () => {
    const parser = new SubscriptionParser();
    expect(() => parser['parseVMessURI']('invalid')).toThrow();
  });
});
```

#### 2. NodeSpeedTester测试

```typescript
describe('NodeSpeedTester', () => {
  it('应该正确测速可用节点', async () => {
    const tester = new NodeSpeedTester();
    const node: ProxyNode = {
      name: 'test',
      type: 'http',
      server: '127.0.0.1',
      port: 8080
    };

    const result = await tester.testNode(node);
    expect(result.nodeName).toBe('test');
    expect(result.delay).toBeGreaterThan(0);
  });

  it('应该标记不可用节点', async () => {
    const tester = new NodeSpeedTester();
    const node: ProxyNode = {
      name: 'invalid',
      type: 'http',
      server: '0.0.0.0',
      port: 1
    };

    const result = await tester.testNode(node);
    expect(result.available).toBe(false);
    expect(result.delay).toBe(-1);
  });
});
```

#### 3. NodeClassifier测试

```typescript
describe('NodeClassifier', () => {
  it('应该正确识别香港节点', () => {
    const classifier = new NodeClassifier();
    expect(classifier['detectRegion']('香港 IPLC 01')).toBe('香港');
    expect(classifier['detectRegion']('HK-Premium')).toBe('香港');
  });

  it('应该按速度分级', () => {
    const classifier = new NodeClassifier();
    const nodes: ProxyNode[] = [
      { name: 'fast', type: 'vmess', server: '1.1.1.1', port: 443 },
      { name: 'slow', type: 'vmess', server: '2.2.2.2', port: 443 }
    ];
    const results: SpeedTestResult[] = [
      { nodeName: 'fast', delay: 50, available: true, testTime: new Date() },
      { nodeName: 'slow', delay: 500, available: true, testTime: new Date() }
    ];

    const groups = classifier.classifyBySpeed(nodes, results);
    expect(groups.highSpeed).toHaveLength(1);
    expect(groups.lowSpeed).toHaveLength(1);
  });
});
```

### 集成测试

```typescript
describe('Clash配置生成完整流程', () => {
  it('应该完整生成Clash配置', async () => {
    // 1. 解析订阅
    const parser = new SubscriptionParser();
    const parseResult = await parser.parse(testSubscriptionContent);

    // 2. 测速
    const tester = new NodeSpeedTester();
    const speedResults = await tester.testNodes(parseResult.nodes);

    // 3. 生成配置
    const generator = new ClashConfigGenerator();
    const config = await generator.generate(parseResult.nodes, speedResults);

    // 验证
    expect(config).toContain('proxies:');
    expect(config).toContain('proxy-groups:');
    expect(config).toContain('rules:');
  });
});
```

---

## 📊 性能优化

### 1. 并发控制

测速时限制并发数，避免网络拥堵：

```typescript
const concurrency = 10; // 同时测试10个节点
```

### 2. 缓存机制

```typescript
// 缓存测速结果24小时
const cacheKey = `speedtest:${node.name}`;
const cached = await cache.get(cacheKey);
if (cached && Date.now() - cached.time < 86400000) {
  return cached.result;
}
```

### 3. 增量更新

仅测速新增节点或24小时内未测速的节点。

---

## 🔐 安全考虑

### 1. 敏感信息保护

- 订阅地址包含token，不记录完整URL到日志
- 生成的配置文件权限设为`600`（仅所有者可读写）

### 2. 输入验证

- 验证订阅URL格式
- 限制节点数量上限（防止恶意订阅）
- 过滤恶意节点名（包含特殊字符）

---

## 🚀 实施计划

### 第一阶段: MVP (1-2天)

- [x] 实现`SubscriptionParser`（支持Clash YAML + Base64）
- [x] 实现基础HTTP延迟测试
- [x] 实现简单地区分类
- [x] 生成基础Clash配置
- [x] CLI命令`clash:generate`

### 第二阶段: 增强 (3-5天)

- [ ] AI节点命名优化
- [ ] 速度分级与高级策略组
- [ ] 流媒体分流规则
- [ ] 完善测试用例

### 第三阶段: 可选 (按需)

- [ ] 集成Clash Meta测速
- [ ] 带宽测试功能
- [ ] 流媒体解锁检测
- [ ] 自定义规则模板

---

## 📝 使用示例

### 示例1: 基础生成

```bash
$ autosub clash:generate

🔍 正在获取订阅地址...
✓ 找到 5 个已配置站点

📥 正在下载订阅内容...
✓ 红杏云: 50 个节点
✓ 糖果云: 30 个节点
✓ 牛逼机场: 45 个节点
✓ 优速通: 25 个节点
✓ 火烧云: 35 个节点

⚡ 正在测速 185 个节点 (并发: 10)...
测速进度: 10/185 (5%)
测速进度: 20/185 (11%)
...
测速进度: 185/185 (100%)
✓ 测速完成: 165 个可用节点

🔧 正在生成Clash配置...
✓ 地区分类: 香港(50) 新加坡(30) 美国(40) 日本(25) 其他(20)
✓ 速度分级: 高速(80) 中速(65) 低速(20)
✓ 策略组生成完成
✓ 规则集生成完成

💾 配置已保存到: /Users/engtyleong/.autosub/clash.yaml

📊 统计信息:
  总节点数: 185
  可用节点: 165 (89.2%)
  高速节点: 80 (48.5%)
  策略组数: 12
  规则数: 45
```

### 示例2: 自定义配置

```bash
$ autosub clash:generate \
  --output ~/clash-premium.yaml \
  --enable-adblock \
  --enable-streaming \
  --concurrency 20 \
  --port 7891

✓ 配置已生成: ~/clash-premium.yaml
```

---

## 🐛 故障排查

### 问题1: 测速全部失败

**可能原因**:
- 网络连接问题
- 节点协议不支持直接测速

**解决方案**:
```bash
# 使用Clash Meta测速
autosub clash:generate --use-clash-meta
```

### 问题2: 解析失败

**可能原因**: 订阅格式不支持

**解决方案**:
```bash
# 查看详细错误
autosub clash:parse <url> --debug
```

### 问题3: 生成的配置无法使用

**可能原因**:
- 节点格式错误
- 缺少必要字段

**解决方案**:
- 检查日志中的警告信息
- 使用`--verbose`查看详细过程

---

## 📚 参考资料

### 开源项目

- [tindy2013/subconverter](https://github.com/tindy2013/subconverter) - C++ 订阅转换器
- [SubConv/SubConv](https://github.com/SubConv/SubConv) - Python 订阅转换器
- [xiecang/speedtest-clash](https://github.com/xiecang/speedtest-clash) - Go 测速工具
- [starudream/clash-speedtest](https://github.com/starudream/clash-speedtest) - Go 测速工具

### 技术文档

- [Clash 配置文档](https://github.com/Dreamacro/clash/wiki/configuration)
- [Clash Meta 文档](https://wiki.metacubex.one/)
- [VMess 协议规范](https://www.v2fly.org/config/protocols/vmess.html)
- [Trojan 协议规范](https://trojan-gfw.github.io/trojan/protocol)

---

## ✅ 验收标准

1. ✅ 支持至少3种订阅格式（Clash YAML / Base64 / V2Ray JSON）
2. ✅ 节点测速准确率 > 95%
3. ✅ 地区识别准确率 > 90%
4. ✅ 生成的配置可直接在Clash中使用
5. ✅ 完整的错误处理和日志记录
6. ✅ 单元测试覆盖率 > 80%
7. ✅ 文档完整（包括API文档和使用指南）

---

## 📅 版本规划

### v1.0.0 (MVP)
- 基础订阅解析
- HTTP延迟测试
- 简单配置生成

### v1.1.0
- AI命名优化
- 高级策略组
- 流媒体规则

### v1.2.0
- Clash Meta集成
- 带宽测速
- 自定义模板

### v2.0.0
- Web UI界面
- 订阅管理器
- 自动更新配置

---

## 👥 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

---

## 📄 许可证

MIT License - 详见 [LICENSE](../LICENSE) 文件

---

**文档维护者**: AutoSub Team
**最后更新**: 2025-01-04
**状态**: 🟢 Active Development
