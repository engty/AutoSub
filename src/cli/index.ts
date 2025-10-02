import { cac } from 'cac';
import chalk from 'chalk';

const cli = cac('clash-autosub');

cli
  .command('update [siteId]', '更新 Clash 订阅')
  .option('--all', '更新所有站点')
  .action(async (_siteId, _options) => {
    console.log(chalk.cyan('Clash AutoSub - 订阅更新'));
    console.log('功能即将完成...');
  });

cli
  .command('setup', '初始化配置')
  .action(async () => {
    console.log(chalk.green('配置初始化成功'));
  });

cli
  .command('status', '查看状态')
  .action(() => {
    console.log(chalk.cyan('Clash AutoSub - 站点状态'));
  });

cli.version('1.0.0');
cli.help();
cli.parse();
