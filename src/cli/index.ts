import { cac } from 'cac';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { AutoUpdateService } from '../service/index.js';
import { ConfigManager } from '../config/manager.js';
import { createEmptySiteConfig } from '../config/schema.js';
import { SiteConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

const cli = cac('clash-autosub');

// 安全加载配置的辅助函数
function safeLoadConfig(): ConfigManager {
  const configManager = new ConfigManager();

  try {
    configManager.load();
  } catch (error: any) {
    // 如果配置加载失败，使用默认配置并保存
    logger.warn('配置加载失败，初始化默认配置:', error.message);
    configManager.save(); // 保存默认配置
  }

  return configManager;
}

// 主菜单
async function showMainMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '请选择操作：',
      choices: [
        { name: '1. 更新订阅', value: 'update' },
        { name: '2. 配置管理', value: 'config' },
        { name: '3. 查看状态', value: 'status' },
        { name: '4. 退出', value: 'exit' },
      ],
    },
  ]);

  switch (action) {
    case 'update':
      await handleUpdate();
      break;
    case 'config':
      await handleConfig();
      break;
    case 'status':
      await handleStatus();
      break;
    case 'exit':
      console.log(chalk.green('再见！'));
      process.exit(0);
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

  const choices = [
    { name: '1. 更新所有站点', value: 'all' },
    ...config.sites.map((site: SiteConfig, index: number) => ({
      name: `${index + 2}. ${site.name || site.id}`,
      value: site.id,
    })),
    { name: '0. 返回', value: 'back' },
  ];

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
      const results = await service.updateAll();
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

// 处理配置
async function handleConfig() {
  const { configAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'configAction',
      message: '配置管理：',
      choices: [
        { name: '1. 添加站点', value: 'add' },
        { name: '2. 编辑站点', value: 'edit' },
        { name: '3. 删除站点', value: 'delete' },
        { name: '4. 查看配置', value: 'view' },
        { name: '0. 返回', value: 'back' },
      ],
    },
  ]);

  switch (configAction) {
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
    case 'back':
      return;
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
  console.log(chalk.white(`订阅站点数量: ${config.sites.length}\n`));

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

cli.version('1.0.0');
cli.help();

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
