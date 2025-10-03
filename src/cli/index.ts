import { cac } from 'cac';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { AutoUpdateService } from '../service/index.js';
import { CookieRefreshService } from '../service/cookie-refresh.js';
import { ConfigManager, getConfigManager } from '../config/manager.js';
import { createEmptySiteConfig } from '../config/schema.js';
import { SiteConfig, AIConfig, AIProvider, AutoSubError, ErrorCode } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { AIConfigManager } from '../ai/ai-config.js';
import { FileUtil } from '../utils/file.js';
import { registerEscPrompts } from './prompts/register-esc-prompts.js';
import { PromptCancelledError } from './prompts/prompt-cancel-error.js';
import { refreshCookieStatuses } from '../service/cookie-status.js';
import { getCookieExpiryInfo, formatExpiryInfo } from '../credentials/cookie-expiry.js';

registerEscPrompts();

let startupStatusRefreshed = false;

async function ensureStartupCookieStatus(): Promise<void> {
  if (startupStatusRefreshed) {
    return;
  }
  try {
    const manager = getConfigManager();
    await refreshCookieStatuses(manager);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`启动时刷新 Cookie 状态失败: ${message}`);
  } finally {
    startupStatusRefreshed = true;
  }
}

// 获取 package.json 的版本号
function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // 尝试多个可能的路径
    const possiblePaths = [
      path.join(__dirname, '../../package.json'),  // 从 src 运行
      path.join(__dirname, '../package.json'),     // 从 dist 运行
      path.join(process.cwd(), 'package.json'),    // 从项目根目录运行
    ];

    for (const pkgPath of possiblePaths) {
      if (fs.existsSync(pkgPath)) {
        const packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return packageJson.version;
      }
    }

    return '1.0.0'; // 默认版本
  } catch (error) {
    return '1.0.0'; // 出错时返回默认版本
  }
}

const VERSION = getVersion();

const cli = cac('clash-autosub');


// 安全加载配置的辅助函数
function safeLoadConfig(): ConfigManager {
  try {
    return getConfigManager();
  } catch (error: any) {
    logger.warn('配置加载失败，初始化默认配置:', error.message);
    return ConfigManager.initialize();
  }
}

function isPromptCancelled(error: unknown): boolean {
  if (!error) {
    return true;
  }

  if (error instanceof PromptCancelledError) {
    return true;
  }

  const maybeError = error as { name?: string; message?: string; type?: string; isTtyError?: boolean };
  const name = maybeError?.name?.toLowerCase();
  const message = maybeError?.message?.toLowerCase();

  if (!name && !message && maybeError?.type === 'escape') {
    return true;
  }

  if (name && ['exitprompt', 'abortprompt', 'aborterror'].includes(name)) {
    return true;
  }

  if (message && ['esc', 'escape'].includes(message)) {
    return true;
  }

  return false;
}

// 清屏函数（已禁用，保留所有输出）
function clearScreen() {
  // 使用 ANSI 转义码清屏并移动光标到左上角
  // console.clear(); // 已注释：保留所有输出便于调试
}

// 显示 ASCII 艺术标题
function showBanner() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // 尝试多个可能的 banner.txt 路径
    const possiblePaths = [
      path.join(__dirname, 'banner.txt'),      // 从 src/cli 运行
      path.join(__dirname, '../src/cli/banner.txt'),  // 从 dist 运行
      path.join(process.cwd(), 'src/cli/banner.txt'), // 从项目根目录运行
    ];

    let bannerContent = '';
    for (const bannerPath of possiblePaths) {
      if (fs.existsSync(bannerPath)) {
        bannerContent = fs.readFileSync(bannerPath, 'utf-8');
        break;
      }
    }

    // 如果找不到文件，使用默认 banner
    if (!bannerContent) {
      console.log('');
      console.log(chalk.cyan('  ══════════════════════════════════════════════════════════════'));
      console.log('');
      console.log(chalk.bold.yellow('                    CLASH AUTOSUB'));
      console.log('');
      console.log(chalk.green(`                VPN 订阅自动化管理工具 v${VERSION}`));
      console.log('');
      console.log(chalk.cyan('  ══════════════════════════════════════════════════════════════'));
      console.log('');
      return;
    }

    // 替换 vx.x.x 占位符为实际版本号
    bannerContent = bannerContent.replace(/vx\.x\.x/g, `v${VERSION}`);

    // 显示 banner（应用颜色）
    console.log(chalk.yellow(bannerContent));
    console.log('');
  } catch (error) {
    // 出错时显示简单 banner
    console.log('');
    console.log(chalk.bold.yellow('CLASH AUTOSUB'));
    console.log(chalk.green(`VPN 订阅自动化管理工具 v${VERSION}`));
    console.log('');
  }
}

// 主菜单
async function showMainMenu() {
  // 清屏并显示标题
  await ensureStartupCookieStatus();
  clearScreen();
  showBanner();

  const configManager = safeLoadConfig();
  const config = configManager.getConfig();
  const aiConfig = configManager.getAIConfig();

  // 生成动态状态指示
  let clashStatusText = '1. Clash 路径配置';
  if (config.clash?.configPath) {
    clashStatusText += chalk.green('（已配置）');
  } else {
    clashStatusText += chalk.red('（未配置）');
  }

  let aiStatusText = '2. AI 智能识别设置';
  if (aiConfig?.enabled) {
    aiStatusText += chalk.green('（已配置）');
  } else {
    aiStatusText += chalk.red('（未配置）');
  }

  const siteCount = config.sites.length;
  const siteStatusText = `3. 订阅站点管理${siteCount > 0 ? chalk.cyan(`（已保存 ${siteCount} 站点）`) : ''}`;

  // 添加按键监听，按 Q 或 q 直接退出
  const promptPromise = inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '请选择操作：',
      choices: [
        { name: clashStatusText, value: 'clash' },
        { name: aiStatusText, value: 'ai' },
        { name: siteStatusText, value: 'sites' },
        { name: '4. 更新订阅', value: 'update' },
        { name: '5. 刷新凭证（保持登录）', value: 'refresh' },
        { name: '6. 查看状态', value: 'status' },
        { name: 'Q. 退出', value: 'exit' },
      ],
    },
  ]);

  // 监听按键事件
  const stdin = process.stdin;

  const keyListener = (chunk: Buffer) => {
    const key = chunk.toString();
    // 按 Q 或 q 键直接退出
    if (key.toLowerCase() === 'q') {
      console.log(chalk.green('\n再见！'));
      process.exit(0);
    }
  };

  stdin.on('data', keyListener);

  try {
    const { action } = await promptPromise;

    // 移除监听器
    stdin.removeListener('data', keyListener);

    switch (action) {
      case 'clash':
        await handleClashConfig();
        break;
      case 'ai':
        await handleAIConfig();
        break;
      case 'sites':
        await handleSiteManagement();
        break;
      case 'update':
        await handleUpdate();
        break;
      case 'refresh':
        await handleRefresh();
        break;
      case 'status':
        await handleStatus();
        break;
      case 'exit':
        console.log(chalk.green('再见！'));
        process.exit(0);
    }
  } catch (error) {
    // 移除监听器
    stdin.removeListener('data', keyListener);

    if (isPromptCancelled(error)) {
      console.log(chalk.yellow('\n已取消操作，返回主菜单。'));
      await showMainMenu();
      return;
    }

    throw error;
  }

  // 循环显示主菜单
  await showMainMenu();
}

// 处理更新
async function handleUpdate() {
  const configManager = safeLoadConfig();
  const config = configManager.getConfig();

  if (config.sites.length === 0) {
    console.log(chalk.yellow('⚠️  还没有配置任何站点，请先添加站点配置'));
    return;
  }

  // 筛选出有效站点(有订阅地址的站点)
  const validSites = config.sites.filter((site: SiteConfig) => site.cookieValid);

  // 构建选项列表
  const choices = [];

  // 只有存在有效站点时才显示"更新所有站点"选项
  if (validSites.length > 0) {
    choices.push({ name: '1. 更新所有站点', value: 'all' });
  }

  // 添加站点选项，有效站点标记绿色
  config.sites.forEach((site: SiteConfig, index: number) => {
    const displayIndex = validSites.length > 0 ? index + 2 : index + 1;
    const siteName = site.name || site.id;
    let statusLabel = chalk.gray('（未保存登录）');
    if (site.cookieValid) {
      statusLabel = chalk.green('（Cookie有效）');
    } else if (site.credentialFile) {
      statusLabel = chalk.yellow('（需重新登录）');
    }

    const displayName = `${displayIndex}. ${siteName} ${statusLabel}`;

    choices.push({
      name: displayName,
      value: site.id,
    });
  });

  choices.push({ name: '0. 返回', value: 'back' });

  // 如果没有有效站点，提示用户
  if (validSites.length === 0) {
    console.log(chalk.yellow('⚠️  暂无 Cookie 有效的站点，"更新所有站点"功能不可用'));
    console.log(chalk.gray('   请先选择单个站点重新登录并保存凭证\n'));
  }

  let siteId: string;
  try {
    ({ siteId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'siteId',
      message: '选择要更新的站点：',
        choices,
      },
    ]));
  } catch (error) {
    if (isPromptCancelled(error)) {
      console.log(chalk.yellow('\n已取消更新，返回上一级菜单。'));
      return;
    }
    throw error;
  }

  if (siteId === 'back') return;

  const service = new AutoUpdateService();

  try {
    console.log(chalk.cyan('\n🚀 开始更新...\n'));
    await service.initialize();

    if (siteId === 'all') {
      // 只更新有效站点
      const results = await service.updateValidSites();
      displayUpdateResults(results);
    } else {
      const result = await service.updateSite(siteId);
      displayUpdateResults([result]);
    }
  } catch (error: any) {
    if (error instanceof PromptCancelledError) {
      console.log(chalk.yellow('\n已取消操作，返回主菜单。'));
      return;
    }

    if (error instanceof AutoSubError && error.code === ErrorCode.USER_CANCELLED) {
      console.log(chalk.yellow('\n用户已取消本次更新，返回上一层菜单。'));
      return;
    }

    logger.error('更新失败:', error);
    console.log(chalk.red(`\n❌ 更新失败: ${error.message}`));
  } finally {
    await service.cleanup();
  }
}

async function updateSiteImmediately(siteId: string): Promise<void> {
  console.log(chalk.cyan('\n🚀 正在尝试立即更新新站点...\n'));

  const service = new AutoUpdateService();

  try {
    await service.initialize();
    const result = await service.updateSite(siteId);
    displayUpdateResults([result]);
  } catch (error: any) {
    if (error instanceof AutoSubError && error.code === ErrorCode.USER_CANCELLED) {
      console.log(chalk.yellow('\n用户已取消自动更新，可稍后在“更新订阅”菜单中手动尝试。'));
      return;
    }

    logger.error('新增站点自动更新失败:', error);
    console.log(chalk.red(`\n❌ 自动更新失败: ${error.message}`));
    console.log(chalk.yellow('稍后可在"更新订阅"菜单中手动重试。'));
  } finally {
    await service.cleanup();
  }
}

// 处理刷新凭证
async function handleRefresh() {
  const configManager = safeLoadConfig();
  const config = configManager.getConfig();

  const sitesWithCreds = config.sites.filter((s: SiteConfig) => s.credentialFile);

  if (sitesWithCreds.length === 0) {
    console.log(chalk.yellow('\n⚠️  还没有保存任何凭证，请先完成至少一次订阅更新'));
    return;
  }

  console.log(chalk.cyan('\n🔄 刷新站点凭证（保持登录状态）\n'));
  console.log(chalk.gray('提示：定期刷新Cookie可以保持长期登录，避免频繁手动登录'));
  console.log(chalk.gray('建议：可以设置定时任务（cron）每3天自动刷新一次\n'));

  const choices = [
    { name: '1. 刷新所有站点', value: 'all' },
  ];

  // 异步构建choices
  for (let index = 0; index < sitesWithCreds.length; index++) {
    const site = sitesWithCreds[index];
    const expiryInfo = await getCookieExpiryInfo(site.id);
    const statusText = formatExpiryInfo(expiryInfo);
    const statusColor = expiryInfo.hasExpired
      ? chalk.red
      : expiryInfo.needsRefresh
        ? chalk.yellow
        : chalk.green;

    choices.push({
      name: `${index + 2}. ${site.name} ${statusColor(`[${statusText}]`)}`,
      value: site.id,
    });
  }

  choices.push({ name: '0. 返回', value: 'back' });

  let siteId: string;
  try {
    ({ siteId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'siteId',
        message: '选择要刷新的站点：',
        choices,
      },
    ]));
  } catch (error) {
    if (isPromptCancelled(error)) {
      console.log(chalk.yellow('\n已取消刷新。'));
      return;
    }
    throw error;
  }

  if (siteId === 'back') return;

  const service = new CookieRefreshService();

  try {
    console.log(chalk.cyan('\n🚀 开始刷新Cookie...\n'));
    await service.initialize(false); // 有头模式，用户可以看到浏览器

    if (siteId === 'all') {
      const results = await service.refreshAll(false); // 只刷新需要的
      displayRefreshResults(results);
    } else {
      const result = await service.refreshSite(siteId);
      displayRefreshResults([result]);
    }
  } catch (error: any) {
    if (error instanceof PromptCancelledError) {
      console.log(chalk.yellow('\n已取消操作。'));
      return;
    }

    logger.error('刷新失败:', error);
    console.log(chalk.red(`\n❌ 刷新失败: ${error.message}`));
  } finally {
    await service.cleanup();
  }
}

// 显示刷新结果
function displayRefreshResults(results: Array<any>) {
  console.log(chalk.cyan('\n📊 刷新结果：\n'));

  const successResults = results.filter((r) => r.success);
  const failedResults = results.filter((r) => !r.success);
  const refreshedResults = results.filter((r) => r.success && r.refreshed);

  results.forEach((result) => {
    if (result.success) {
      if (result.refreshed) {
        console.log(
          chalk.green(`✓ ${result.siteName}: Cookie已刷新`) +
            chalk.gray(` (${result.oldExpiryDays || '?'}天 → ${result.newExpiryDays || '?'}天)`)
        );
      } else if (result.oldExpiryDays === result.newExpiryDays) {
        console.log(
          chalk.gray(`○ ${result.siteName}: 跳过`) +
            chalk.gray(` (剩余 ${result.oldExpiryDays || '?'}天，无需刷新)`)
        );
      } else {
        console.log(
          chalk.yellow(`⚠ ${result.siteName}: Cookie未变化`) +
            chalk.gray(` (该站点可能不支持自动续期)`)
        );
      }
    } else {
      console.log(chalk.red(`✗ ${result.siteName}: ${result.error}`));
    }
  });

  console.log();
  console.log(chalk.cyan(`总计: ${results.length} 个站点`));
  console.log(chalk.green(`成功: ${successResults.length} 个`));
  console.log(chalk.blue(`刷新: ${refreshedResults.length} 个`));
  if (failedResults.length > 0) {
    console.log(chalk.red(`失败: ${failedResults.length} 个`));
  }
  console.log();

  if (refreshedResults.length > 0) {
    console.log(chalk.green('✓ Cookie有效期已延长！'));
    console.log(chalk.gray('提示：可以设置定时任务（cron）定期自动刷新'));
    console.log(chalk.gray('命令：npm start refresh-credentials --headless'));
  }
}

// 处理 Clash 配置
async function handleClashConfig() {
  await configureClash();
}

// 处理 AI 设置
async function handleAIConfig() {
  await configureAI();
}

// 处理站点管理
async function handleSiteManagement() {
  let siteAction: string;
  try {
    ({ siteAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'siteAction',
      message: '站点管理：',
        choices: [
          { name: '1. 添加站点', value: 'add' },
          { name: '2. 编辑站点', value: 'edit' },
          { name: '3. 删除站点', value: 'delete' },
          { name: '4. 查看站点配置', value: 'view' },
          { name: '0. 返回', value: 'back' },
        ],
      },
    ]));
  } catch (error) {
    if (isPromptCancelled(error)) {
      console.log(chalk.yellow('\n已取消站点管理。'));
      return;
    }
    throw error;
  }

  if (siteAction === 'back') return;

  switch (siteAction) {
    case 'add':
      await addSite();
      break;
    case 'edit':
      await editSite();
      break;
    case 'delete':
      await deleteSite();
      break;
    case 'view':
      await viewConfig();
      break;
  }
}


// 添加站点
async function addSite() {
  let answers: {
    name: string;
    url: string;
    extractionMode: 'api' | 'dom' | 'clipboard';
  };

  try {
    answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '订阅站点名称:',
        validate: (input) => (input.trim() ? true : '请输入站点名称'),
      },
      {
        type: 'input',
        name: 'url',
        message: '订阅页面网址:',
        validate: (input) => {
          try {
            new URL(input);
            return true;
          } catch {
            return '请输入有效的网址';
          }
        },
      },
      {
        type: 'list',
        name: 'extractionMode',
        message: '获取方式:',
        choices: [
          { name: '1. 自动获取（推荐）', value: 'api' },
          { name: '2. 网页解析', value: 'dom' },
          { name: '3. 手动复制', value: 'clipboard' },
        ],
        default: 'api',
      },
    ]);
  } catch (error: any) {
    if (isPromptCancelled(error)) {
      console.log(chalk.yellow('\n已取消添加站点。'));
      return;
    }
    throw error;
  }

  const configManager = safeLoadConfig();

  // 使用名称生成 ID（移除特殊字符，转为小写）
  const id = answers.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const siteConfig = createEmptySiteConfig(id, answers.name, answers.url);

  // 覆盖提取模式
  siteConfig.extractionMode = answers.extractionMode;

  configManager.addSite(siteConfig);
  configManager.save();

  console.log(chalk.green(`\n✅ 站点 "${answers.name}" 添加成功！`));

  if (siteConfig.extractionMode !== 'clipboard') {
    await updateSiteImmediately(siteConfig.id);
  } else {
    console.log(
      chalk.yellow('\n提示: 该站点使用手动复制模式，可在“更新订阅”菜单中手动运行。')
    );
  }
}

// 编辑站点
async function editSite() {
  const configManager = safeLoadConfig();
  const config = configManager.getConfig();

  if (config.sites.length === 0) {
    console.log(chalk.yellow('⚠️  还没有配置任何站点'));
    return;
  }

  let siteId: string;
  try {
    ({ siteId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'siteId',
      message: '选择要编辑的站点:',
        choices: config.sites.map((site: SiteConfig) => ({
          name: `${site.name || site.id} (${site.url})`,
          value: site.id,
        })),
      },
    ]));
  } catch (error) {
    if (isPromptCancelled(error)) {
      console.log(chalk.yellow('\n已取消编辑。'));
      return;
    }
    throw error;
  }

  const site = config.sites.find((s: SiteConfig) => s.id === siteId);
  if (!site) return;

  let answers: { name: string; url: string; extractionMode: 'api' | 'dom' | 'clipboard' };
  try {
    answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '站点名称:',
        default: site.name,
      },
      {
        type: 'input',
        name: 'url',
        message: '订阅页面网址:',
        default: site.url,
      },
      {
        type: 'list',
        name: 'extractionMode',
      message: '获取方式:',
        choices: [
          { name: '1. 自动获取', value: 'api' },
          { name: '2. 网页解析', value: 'dom' },
          { name: '3. 手动复制', value: 'clipboard' },
        ],
        default: site.extractionMode,
      },
    ]);
  } catch (error) {
    if (isPromptCancelled(error)) {
      console.log(chalk.yellow('\n已取消编辑。'));
      return;
    }
    throw error;
  }

  Object.assign(site, answers);
  configManager.save();

  console.log(chalk.green(`\n✅ 站点 "${site.name || site.id}" 更新成功！`));
}

// 删除站点
async function deleteSite() {
  const configManager = safeLoadConfig();
  const config = configManager.getConfig();

  if (config.sites.length === 0) {
    console.log(chalk.yellow('⚠️  还没有配置任何站点'));
    return;
  }

  let siteId: string;
  try {
    ({ siteId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'siteId',
      message: '选择要删除的站点:',
        choices: config.sites.map((site: SiteConfig) => ({
          name: `${site.name || site.id} (${site.url})`,
          value: site.id,
        })),
      },
    ]));
  } catch (error) {
    if (isPromptCancelled(error)) {
      console.log(chalk.yellow('\n已取消删除。'));
      return;
    }
    throw error;
  }

  let confirm: boolean;
  try {
    ({ confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
      message: '确认删除？',
        default: false,
      },
    ]));
  } catch (error) {
    if (isPromptCancelled(error)) {
      console.log(chalk.yellow('\n已取消删除。'));
      return;
    }
    throw error;
  }

  if (confirm) {
    configManager.deleteSite(siteId);
    configManager.save();
    console.log(chalk.green('\n✅ 站点删除成功！'));
  }
}

// 查看配置
async function viewConfig() {
  const configManager = safeLoadConfig();
  const config = configManager.getConfig();

  console.log(chalk.cyan('\n📋 当前配置:\n'));
  console.log(chalk.white(`Clash 配置文件: ${config.clash?.configPath || '未设置'}`));
  console.log(chalk.white(`订阅站点数量: ${config.sites.length}`));

  // 显示 AI 配置
  if (config.ai) {
    console.log(chalk.white(`AI 智能识别: ${config.ai.enabled ? chalk.green('已启用') : chalk.gray('未启用')}`));
    if (config.ai.enabled) {
      const providerConfig = AIConfigManager.getProviderConfig(config.ai.provider);
      console.log(chalk.gray(`  提供商: ${providerConfig.name}`));
      console.log(chalk.gray(`  模型: ${AIConfigManager.getModel(config.ai)}`));
    }
  } else {
    console.log(chalk.white(`AI 智能识别: ${chalk.gray('未配置')}`));
  }

  console.log(); // 空行

  if (config.sites.length > 0) {
    console.log(chalk.cyan('站点列表:'));
    config.sites.forEach((site: SiteConfig, index: number) => {
      console.log(chalk.white(`\n${index + 1}. ${site.name || site.id}`));
      console.log(chalk.gray(`   网址: ${site.url}`));
      const modeText =
        site.extractionMode === 'api'
          ? '自动获取'
          : site.extractionMode === 'dom'
            ? '网页解析'
            : '手动复制';
      console.log(chalk.gray(`   获取方式: ${modeText}`));
      if (site.cookieValid) {
        console.log(chalk.gray('   Cookie 状态: 已生效'));
      } else if (site.credentialFile) {
        console.log(chalk.gray('   Cookie 状态: 需要重新登录'));
      } else {
        console.log(chalk.gray('   Cookie 状态: 未保存'));
      }
      if (site.credentialsUpdatedAt) {
        console.log(chalk.gray(`   凭证更新时间: ${site.credentialsUpdatedAt}`));
      }
      console.log(chalk.gray(`   订阅地址: ${site.subscriptionUrl || '未获取'}`));
    });
  }

  console.log(); // 空行
}

// 配置 Clash
async function configureClash() {
  const configManager = safeLoadConfig();
  const config = configManager.getConfig();
  const currentPath = config.clash?.configPath;

  console.log(chalk.cyan('\n⚙️  Clash 配置路径设置\n'));

  if (currentPath) {
    console.log(chalk.gray('当前配置路径:'));
    console.log(chalk.white(`  ${currentPath}`));
    console.log();
  } else {
    console.log(chalk.yellow('⚠️  尚未设置 Clash 配置文件路径'));
    console.log(chalk.gray('   请选择或设置 Clash 的 config.yaml 文件路径\n'));
  }

  let action: 'scan' | 'manual' | 'back';
  try {
    ({ action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
      message: '选择操作:',
        choices: [
          { name: '1. 智能扫描并选择', value: 'scan' },
          { name: '2. 手动输入路径', value: 'manual' },
          { name: '0. 返回', value: 'back' },
        ],
      },
    ]));
  } catch (error) {
    if (isPromptCancelled(error)) {
      console.log(chalk.yellow('\n已取消配置。'));
      return;
    }
    throw error;
  }

  if (action === 'back') return;

  if (action === 'scan') {
    // 智能扫描 Clash 配置文件
    console.log(chalk.cyan('\n🔍 正在扫描 ~/.config 目录下的 Clash 配置文件...\n'));

    const clashFiles = FileUtil.scanClashConfigFiles();

    if (clashFiles.length === 0) {
      console.log(chalk.yellow('⚠️  未找到任何 Clash 配置文件'));
      console.log(chalk.gray('   请手动输入配置文件路径\n'));
      return;
    }

    console.log(chalk.green(`✓ 找到 ${clashFiles.length} 个配置文件:\n`));

    // 构建选择列表
    const choices = [
      ...clashFiles.map((file, index) => ({
        name: `${index + 1}. ${file}`,
        value: file,
      })),
      { name: chalk.gray('0. 取消'), value: null },
    ];

    let selectedFile: string | null;
    try {
      ({ selectedFile } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedFile',
        message: '选择配置文件:',
          choices,
          pageSize: 15,
        },
      ]));
    } catch (error) {
      if (isPromptCancelled(error)) {
        console.log(chalk.yellow('\n已取消配置。'));
        return;
      }
      throw error;
    }

    if (selectedFile) {
      configManager.setClashConfigPath(selectedFile);
      configManager.save();
      console.log(chalk.green(`\n✓ Clash 配置路径已保存: ${selectedFile}`));
    }
  } else if (action === 'manual') {
    // 手动输入路径
    let configPath: string;
    try {
      ({ configPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'configPath',
          message: 'Clash 配置文件路径 (config.yaml):',
          default: currentPath || '',
          validate: (input) => {
            if (!input.trim()) {
              return '请输入配置文件路径';
            }
            if (!fs.existsSync(input)) {
              return `文件不存在: ${input}`;
            }
            if (!input.endsWith('.yaml') && !input.endsWith('.yml')) {
              return '配置文件必须是 YAML 格式 (.yaml 或 .yml)';
            }
            return true;
          },
        },
      ]));
    } catch (error) {
      if (isPromptCancelled(error)) {
        console.log(chalk.yellow('\n已取消配置。'));
        return;
      }
      throw error;
    }

    configManager.setClashConfigPath(configPath);
    configManager.save();
    console.log(chalk.green('\n✓ Clash 配置路径已保存'));
  }

  console.log(); // 空行
}

// 配置 AI
async function configureAI() {
  const configManager = safeLoadConfig();
  const currentConfig = configManager.getAIConfig();

  console.log(chalk.cyan('\n🤖 AI 智能识别设置\n'));

  if (currentConfig) {
    console.log(chalk.gray('当前配置:'));
    console.log(AIConfigManager.formatConfigForDisplay(currentConfig));
    console.log();
  }

  const toggleText = currentConfig?.enabled
    ? `1. AI 识别（${chalk.green('启用')}/${chalk.gray('禁用')}）`
    : `1. AI 识别（${chalk.gray('启用')}/${chalk.red('禁用')}）`;

  let action: 'toggle' | 'configure' | 'back';
  try {
    ({ action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
      message: '选择操作:',
        choices: [
          { name: toggleText, value: 'toggle' },
          { name: '2. 配置 AI 提供商', value: 'configure' },
          { name: '0. 返回', value: 'back' },
        ],
      },
    ]));
  } catch (error) {
    if (isPromptCancelled(error)) {
      console.log(chalk.yellow('\n已取消 AI 设置。'));
      return;
    }
    throw error;
  }

  if (action === 'back') {
    return;
  }

  if (action === 'toggle') {
    let enabled: boolean;
    try {
      ({ enabled } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'enabled',
          message: 'AI 智能识别',
          default: currentConfig?.enabled || false,
        },
      ]));
    } catch (error) {
      if (isPromptCancelled(error)) {
        console.log(chalk.yellow('\n已取消 AI 设置。'));
        return;
      }
      throw error;
    }

    configManager.toggleAI(enabled);
    configManager.save();

    console.log(chalk.green(`\n✅ AI 智能识别已${enabled ? '启用' : '禁用'}`));
    return;
  }

  if (action === 'configure') {
    const providers = AIConfigManager.getAvailableProviders();
    type ProviderOption = AIProvider | 'back';

    let providerSelection: { provider: ProviderOption };
    try {
      providerSelection = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: '选择 AI 提供商:',
          choices: [
            ...providers.map((p) => ({ name: p.name, value: p.value })),
            { name: '返回', value: 'back' },
          ],
          default: currentConfig?.provider || 'deepseek',
        },
      ]);
    } catch (error) {
      if (isPromptCancelled(error)) {
        console.log(chalk.yellow('\n已取消 AI 设置。'));
        return;
      }
      throw error;
    }

    const provider = providerSelection.provider;
    if (provider === 'back') {
      return;
    }

    let customApiUrl: string | undefined;

    if (provider === 'custom') {
      try {
        const { customApiUrl: url } = await inquirer.prompt([
          {
            type: 'input',
            name: 'providerName',
            message: '提供商名称:',
            default: currentConfig?.provider === 'custom' ? '自定义提供商' : '',
            validate: (input) => (input.trim() ? true : '请输入提供商名称'),
          },
          {
            type: 'input',
            name: 'customApiUrl',
            message: 'API 地址:',
            default: currentConfig?.customApiUrl || '',
            validate: (input) => {
              try {
                new URL(input);
                return true;
              } catch {
                return '请输入有效的 URL';
              }
            },
          },
        ]);
        customApiUrl = url;
      } catch (error) {
        if (isPromptCancelled(error)) {
          console.log(chalk.yellow('\n已取消 AI 设置。'));
          return;
        }
        throw error;
      }
    }

    let credentials: { apiKey: string; model: string };
    try {
      credentials = await inquirer.prompt([
        {
          type: 'input',
          name: 'apiKey',
          message: 'API 密钥:',
          default: currentConfig?.apiKey || '',
          validate: (input) => (input.trim() ? true : '请输入 API 密钥'),
        },
        {
          type: 'input',
          name: 'model',
          message: () => {
            if (provider === 'custom') {
              return '模型名称:';
            }
            const providerConfig = AIConfigManager.getProviderConfig(provider);
            return `模型名称 (默认: ${providerConfig.defaultModel}):`;
          },
          default: () => {
            if (currentConfig?.provider === provider && currentConfig?.model) {
              return currentConfig.model;
            }
            if (provider === 'custom') {
              return '';
            }
            return AIConfigManager.getProviderConfig(provider).defaultModel;
          },
          validate: (input) => {
            if (provider === 'custom' && !input.trim()) {
              return '请输入模型名称';
            }
            return true;
          },
        },
      ]);
    } catch (error) {
      if (isPromptCancelled(error)) {
        console.log(chalk.yellow('\n已取消 AI 设置。'));
        return;
      }
      throw error;
    }

    const newConfig: AIConfig = {
      enabled: true,
      provider,
      apiKey: credentials.apiKey,
      model: credentials.model,
      customApiUrl,
    };

    try {
      configManager.setAIConfig(newConfig);
      configManager.save();

      console.log(chalk.green('\n✅ AI 配置保存成功！\n'));
      console.log(AIConfigManager.formatConfigForDisplay(newConfig));
    } catch (error: any) {
      console.log(chalk.red(`\n❌ 配置保存失败: ${error.message}`));
    }
  }
}

// 处理状态
async function handleStatus() {
  const configManager = safeLoadConfig();
  const config = configManager.getConfig();

  console.log(chalk.cyan('\n📊 系统状态:\n'));
  console.log(chalk.white(`✅ Clash 配置: ${config.clash?.configPath || '❌ 未设置'}`));
  console.log(chalk.white(`✅ 订阅站点: ${config.sites.length} 个`));

  if (config.sites.length > 0) {
    console.log(chalk.cyan('\n站点状态:'));

    for (const site of config.sites) {
      const status = site.subscriptionUrl ? '🟢 已配置' : '🔴 待配置';
      const lastUpdate = site.lastUpdate
        ? new Date(site.lastUpdate).toLocaleString('zh-CN')
        : '从未更新';

      // 获取 Cookie 状态
      const expiryInfo = await getCookieExpiryInfo(site.id);
      const cookieStatusText = formatExpiryInfo(expiryInfo);
      const cookieStatusColor = expiryInfo.hasExpired
        ? chalk.red
        : expiryInfo.needsRefresh
          ? chalk.yellow
          : chalk.green;

      console.log(chalk.white(`\n${site.name || site.id}: ${status}`));
      console.log(chalk.gray(`  最后更新: ${lastUpdate}`));
      if (site.enabled !== undefined) {
        console.log(chalk.gray(`  状态: ${site.enabled ? '已启用' : '已禁用'}`));
      }

      // 显示 Cookie 状态
      console.log(chalk.gray(`  Cookie: ${cookieStatusColor(cookieStatusText)}`));

      // 显示订阅地址
      if (site.subscriptionUrl) {
        // 截断过长的 URL，只显示前 60 个字符
        const displayUrl = site.subscriptionUrl.length > 60
          ? site.subscriptionUrl.substring(0, 60) + '...'
          : site.subscriptionUrl;
        console.log(chalk.gray(`  订阅地址: ${displayUrl}`));
      } else {
        console.log(chalk.gray(`  订阅地址: ${chalk.red('未配置')}`));
      }
    }
  }

  console.log(); // 空行
}

// 处理卸载
async function handleUninstall(keepConfig: boolean = false) {
  let confirm: boolean;
  try {
    ({ confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: keepConfig
          ? '确认卸载程序？（配置文件将保留）'
          : '确认卸载程序并删除所有数据？',
        default: false,
      },
    ]));
  } catch (error) {
    if (isPromptCancelled(error)) {
      console.log(chalk.yellow('\n已取消卸载。'));
      return;
    }
    throw error;
  }

  if (!confirm) {
    console.log(chalk.yellow('\n已取消卸载'));
    return;
  }

  console.log(chalk.cyan('\n开始卸载...\n'));

  // 导入必要的模块
  const { default: fs } = await import('fs-extra');
  const { default: path } = await import('path');
  const { default: os } = await import('os');

  const configDir = path.join(os.homedir(), '.autosub');

  try {
    if (!keepConfig && fs.existsSync(configDir)) {
      // 删除配置目录
      fs.removeSync(configDir);
      console.log(chalk.green(`✓ 已删除配置目录: ${configDir}`));
    } else if (keepConfig) {
      console.log(chalk.yellow(`✓ 配置文件已保留: ${configDir}`));
    }

    console.log(chalk.cyan('\n请手动执行以下命令完成卸载:\n'));
    console.log(chalk.white('  全局安装的用户:'));
    console.log(chalk.gray('    npm uninstall -g clash-autosub\n'));
    console.log(chalk.white('  或清理 npx 缓存:'));
    console.log(chalk.gray('    npx clear-npx-cache\n'));

    if (!keepConfig) {
      console.log(chalk.green('✓ 数据清理完成！'));
    }
  } catch (error: any) {
    console.log(chalk.red(`\n❌ 清理失败: ${error.message}`));
  }
}

// 显示更新结果
function displayUpdateResults(results: any[]) {
  console.log(chalk.cyan('\n📊 更新结果:\n'));

  results.forEach((result) => {
    const icon = result.success ? '✅' : '❌';
    const color = result.success ? chalk.green : chalk.red;

    console.log(color(`${icon} ${result.siteId}`));

    if (result.success) {
      console.log(chalk.gray(`   节点数量: ${result.nodeCount || 0}`));
      console.log(chalk.gray(`   订阅地址: ${result.subscriptionUrl || 'N/A'}`));
    } else {
      console.log(chalk.gray(`   错误: ${result.error || '未知错误'}`));
    }
  });

  console.log(); // 空行
}

// 命令行模式
cli
  .command('update [siteId]', '更新 Clash 订阅')
  .option('--all', '更新所有站点')
  .action(async (siteId, options) => {
    const service = new AutoUpdateService();

    try {
      await service.initialize();

      if (options.all || !siteId) {
        const results = await service.updateAll();
        displayUpdateResults(results);
      } else {
        const result = await service.updateSite(siteId);
        displayUpdateResults([result]);
      }
    } catch (error: any) {
      logger.error('更新失败:', error);
      console.log(chalk.red(`❌ 更新失败: ${error.message}`));
      process.exit(1);
    } finally {
      await service.cleanup();
    }
  });

cli
  .command('setup', '初始化配置')
  .action(async () => {
    await addSite();
  });

cli
  .command('status', '查看状态')
  .action(async () => {
    await handleStatus();
  });

cli
  .command('refresh-credentials [siteId]', '刷新站点Cookie（保持登录）')
  .option('--headless', '无头模式运行（后台运行，不显示浏览器窗口）')
  .option('--all', '刷新所有站点')
  .option('--force', '强制刷新所有站点（包括不需要刷新的）')
  .action(async (siteId, options) => {
    const service = new CookieRefreshService();

    try {
      console.log(chalk.cyan(`\n🔄 刷新站点Cookie（${options.headless ? '无头' : '有头'}模式）...\n`));
      await service.initialize(options.headless || false);

      let results;
      if (options.all || !siteId) {
        results = await service.refreshAll(options.force || false);
      } else {
        const result = await service.refreshSite(siteId);
        results = [result];
      }

      displayRefreshResults(results);
    } catch (error: any) {
      logger.error('刷新失败:', error);
      console.log(chalk.red(`❌ 刷新失败: ${error.message}`));
      process.exit(1);
    } finally {
      await service.cleanup();
    }
  });

cli
  .command('uninstall', '卸载并清理数据')
  .option('--keep-config', '保留配置文件')
  .action(async (options) => {
    await handleUninstall(options.keepConfig);
  });

cli.version('1.0.0');
cli.help();

// 导出供测试使用
export { ConfigManager } from '../config/manager.js';
export { AIConfigManager } from '../ai/ai-config.js';
export { AutoUpdateService } from '../service/index.js';

// 如果没有参数，显示交互式菜单
if (process.argv.length === 2) {
  console.log(chalk.cyan.bold('\n🚀 Clash AutoSub - VPN 订阅自动化工具\n'));
  showMainMenu().catch((error) => {
    logger.error('程序错误:', error);
    console.log(chalk.red(`\n❌ 程序错误: ${error.message}`));
    process.exit(1);
  });
} else {
  cli.parse();
}
