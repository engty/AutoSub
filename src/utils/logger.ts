import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { LogLevel, LogOptions } from '../types/index.js';

/**
 * 日志管理器类
 */
class Logger {
  private level: LogLevel = LogLevel.INFO;
  private prefix: string = '';
  private timestamp: boolean = true;
  private fileOutput: boolean = false;
  private logFilePath?: string;

  constructor(options?: Partial<LogOptions>) {
    if (options) {
      this.level = options.level ?? LogLevel.INFO;
      this.prefix = options.prefix ?? '';
      this.timestamp = options.timestamp ?? true;
      this.fileOutput = options.fileOutput ?? false;
    }
  }

  /**
   * 设置日志文件路径
   */
  setLogFile(filePath: string): void {
    this.logFilePath = filePath;
    fs.ensureDirSync(path.dirname(filePath));
  }

  /**
   * 获取时间戳字符串
   */
  private getTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, message: string): string {
    const parts: string[] = [];

    if (this.timestamp) {
      parts.push(`[${this.getTimestamp()}]`);
    }

    parts.push(`[${level.toUpperCase()}]`);

    if (this.prefix) {
      parts.push(`[${this.prefix}]`);
    }

    parts.push(message);

    return parts.join(' ');
  }

  /**
   * 写入文件日志
   */
  private writeToFile(message: string): void {
    if (this.fileOutput && this.logFilePath) {
      const plainMessage = message.replace(
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        ''
      );
      fs.appendFileSync(this.logFilePath, plainMessage + '\n');
    }
  }

  /**
   * 检查日志级别是否应该输出
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.level);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  /**
   * Debug 级别日志
   */
  debug(message: string, ...args: any[]): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const formatted = this.formatMessage(LogLevel.DEBUG, message);
    console.log(chalk.gray(formatted), ...args);
    this.writeToFile(formatted + ' ' + args.map(a => JSON.stringify(a)).join(' '));
  }

  /**
   * Info 级别日志
   */
  info(message: string, ...args: any[]): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const formatted = this.formatMessage(LogLevel.INFO, message);
    console.log(chalk.blue(formatted), ...args);
    this.writeToFile(formatted + ' ' + args.map(a => JSON.stringify(a)).join(' '));
  }

  /**
   * Warn 级别日志
   */
  warn(message: string, ...args: any[]): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const formatted = this.formatMessage(LogLevel.WARN, message);
    console.warn(chalk.yellow(formatted), ...args);
    this.writeToFile(formatted + ' ' + args.map(a => JSON.stringify(a)).join(' '));
  }

  /**
   * Error 级别日志
   */
  error(message: string, error?: Error | any): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const formatted = this.formatMessage(LogLevel.ERROR, message);
    console.error(chalk.red(formatted));

    if (error) {
      if (error instanceof Error) {
        console.error(chalk.red(error.stack || error.message));
        this.writeToFile(formatted + '\n' + (error.stack || error.message));
      } else {
        console.error(chalk.red(JSON.stringify(error, null, 2)));
        this.writeToFile(formatted + '\n' + JSON.stringify(error, null, 2));
      }
    } else {
      this.writeToFile(formatted);
    }
  }

  /**
   * Success 日志（特殊类型，使用绿色）
   */
  success(message: string): void {
    const formatted = this.formatMessage(LogLevel.INFO, message);
    console.log(chalk.green(formatted));
    this.writeToFile(formatted);
  }
}

// 导出默认实例
export const logger = new Logger({
  level: LogLevel.INFO,
  timestamp: true,
  fileOutput: false,
});

// 导出类供自定义使用
export { Logger };
