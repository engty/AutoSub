import { cac } from 'cac';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { AutoUpdateService } from '../service/index.js';
import { ConfigManager, getConfigManager } from '../config/manager.js';
import { createEmptySiteConfig } from '../config/schema.js';
import { SiteConfig, AIConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { AIConfigManager } from '../ai/ai-config.js';
import { FileUtil } from '../utils/file.js';

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

// 清屏函数
function clearScreen() {
  // 使用 ANSI 转义码清屏并移动光标到左上角
  console.clear();
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
        { name: '5. 查看状态', value: 'status' },
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
  const validSites = config.sites.filter((site: SiteConfig) => site.subscriptionUrl);

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
    const displayName = site.subscriptionUrl
      ? `${displayIndex}. ${siteName}${chalk.green('（有效）')}`
      : `${displayIndex}. ${siteName}`;

    choices.push({
      name: displayName,
      value: site.id,
    });
  });

  choices.push({ name: '0. 返回', value: 'back' });

  // 如果没有有效站点，提示用户
  if (validSites.length === 0) {
    console.log(chalk.yellow('⚠️  没有有效站点（未保存订阅地址），无法使用"更新所有站点"功能'));
    console.log(chalk.gray('   请先手动更新单个站点以保存登录信息\n'));
  }

  const { siteId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'siteId',
      message: '选择要更新的站点：',
      choices,
    },
  ]);

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
    logger.error('更新失败:', error);
    console.log(chalk.red(`\n❌ 更新失败: ${error.message}`));
  } finally {
    await service.cleanup();
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
  const { siteAction } = await inquirer.prompt([
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
  ]);

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
  const answers = await inquirer.prompt([
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
}

// 编辑站点
async function editSite() {
  const configManager = safeLoadConfig();
  const config = configManager.getConfig();

  if (config.sites.length === 0) {
    console.log(chalk.yellow('⚠️  还没有配置任何站点'));
    return;
  }

  const { siteId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'siteId',
      message: '选择要编辑的站点:',
      choices: config.sites.map((site: SiteConfig) => ({
        name: `${site.name || site.id} (${site.url})`,
        value: site.id,
      })),
    },
  ]);

  const site = config.sites.find((s: SiteConfig) => s.id === siteId);
  if (!site) return;

  const answers = await inquirer.prompt([
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

  const { siteId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'siteId',
      message: '选择要删除的站点:',
      choices: config.sites.map((site: SiteConfig) => ({
        name: `${site.name || site.id} (${site.url})`,
        value: site.id,
      })),
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: '确认删除？',
      default: false,
    },
  ]);

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

  const { action } = await inquirer.prompt([
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
  ]);

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

    const { selectedFile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedFile',
        message: '选择配置文件:',
        choices,
        pageSize: 15,
      },
    ]);

    if (selectedFile) {
      configManager.setClashConfigPath(selectedFile);
      configManager.save();
      console.log(chalk.green(`\n✓ Clash 配置路径已保存: ${selectedFile}`));
    }
  } else if (action === 'manual') {
    // 手动输入路径
    const { configPath } = await inquirer.prompt([
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
    ]);

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

  // 生成菜单选项,显示启用/禁用状态
  const toggleText = currentConfig?.enabled
    ? `1. AI 识别（${chalk.green('启用')}/${chalk.gray('禁用')}）`
    : `1. AI 识别（${chalk.gray('启用')}/${chalk.red('禁用')}）`;

  const { action } = await inquirer.prompt([
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
  ]);

  if (action === 'back') return;

  if (action === 'toggle') {
    const { enabled } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enabled',
        message: 'AI 智能识别',
        default: currentConfig?.enabled || false,
      },
    ]);

    configManager.toggleAI(enabled);
    configManager.save();

    console.log(chalk.green(`\n✅ AI 智能识别已${enabled ? '启用' : '禁用'}`));
    return;
  }

  if (action === 'configure') {
    const providers = AIConfigManager.getAvailableProviders();

    const answers = await inquirer.prompt([
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

    // 如果用户选择返回
    if (answers.provider === 'back') {
      return;
    }

    let customApiUrl: string | undefined;

    // 如果是自定义提供商,先询问提供商信息
    if (answers.provider === 'custom') {
      const customProviderAnswers = await inquirer.prompt([
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
      customApiUrl = customProviderAnswers.customApiUrl;
      // 注意: 提供商名称仅用于用户确认,不保存到配置中
    }

    // 询问 API 密钥和模型名称
    const moreAnswers = await inquirer.prompt([
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
          if (answers.provider === 'custom') {
            return '模型名称:';
          }
          const providerConfig = AIConfigManager.getProviderConfig(answers.provider);
          return `模型名称 (默认: ${providerConfig.defaultModel}):`;
        },
        default: () => {
          if (currentConfig?.provider === answers.provider && currentConfig?.model) {
            return currentConfig.model;
          }
          if (answers.provider === 'custom') {
            return '';
          }
          return AIConfigManager.getProviderConfig(answers.provider).defaultModel;
        },
        validate: (input) => {
          if (answers.provider === 'custom' && !input.trim()) {
            return '请输入模型名称';
          }
          return true;
        },
      },
    ]);

    // 合并答案
    Object.assign(answers, moreAnswers);

    const newConfig: AIConfig = {
      enabled: true,
      provider: answers.provider,
      apiKey: answers.apiKey,
      model: answers.model,
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
    config.sites.forEach((site: SiteConfig) => {
      const status = site.subscriptionUrl ? '🟢 已配置' : '🔴 待配置';
      const lastUpdate = site.lastUpdate
        ? new Date(site.lastUpdate).toLocaleString('zh-CN')
        : '从未更新';

      console.log(chalk.white(`\n${site.name || site.id}: ${status}`));
      console.log(chalk.gray(`  最后更新: ${lastUpdate}`));
      if (site.enabled !== undefined) {
        console.log(chalk.gray(`  状态: ${site.enabled ? '已启用' : '已禁用'}`));
      }
    });
  }

  console.log(); // 空行
}

// 处理卸载
async function handleUninstall(keepConfig: boolean = false) {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: keepConfig
        ? '确认卸载程序？（配置文件将保留）'
        : '确认卸载程序并删除所有数据？',
      default: false,
    },
  ]);

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
