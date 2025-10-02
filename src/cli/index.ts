import cac from 'cac';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

const cli = cac('autosub');

cli
  .version(pkg.version)
  .help()
  .option('--debug', '启用调试模式');

cli
  .command('', '打开交互式菜单（默认）')
  .action(async () => {
    console.log(chalk.cyan('🚀 AutoSub - VPN 订阅自动化工具'));
    console.log(chalk.gray('交互式菜单开发中...'));
  });

cli
  .command('setup', '配置订阅站点')
  .action(async () => {
    console.log(chalk.blue('📋 订阅站点配置向导'));
    console.log(chalk.gray('配置向导开发中...'));
  });

cli
  .command('update', '手动更新订阅')
  .option('--silent', '静默模式（适用于 Cron）')
  .action(async (options) => {
    console.log(chalk.green('🔄 正在更新订阅地址...'));
    console.log(chalk.gray('更新功能开发中...'));
  });

cli
  .command('cron', '配置定时任务')
  .action(async () => {
    console.log(chalk.yellow('⏰ 定时任务配置'));
    console.log(chalk.gray('定时任务功能开发中...'));
  });

cli
  .command('status', '查看状态')
  .action(async () => {
    console.log(chalk.magenta('📊 订阅状态'));
    console.log(chalk.gray('状态查看功能开发中...'));
  });

cli.parse();
