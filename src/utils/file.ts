import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { BackupMetadata } from '../types/index.js';

/**
 * 配置目录路径
 */
export const CONFIG_DIR = path.join(os.homedir(), '.autosub');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml');
export const BACKUP_DIR = path.join(CONFIG_DIR, 'backups');
export const LOG_DIR = path.join(CONFIG_DIR, 'logs');

/**
 * 文件工具类
 */
export class FileUtil {
  /**
   * 确保目录存在
   */
  static ensureDir(dirPath: string): void {
    fs.ensureDirSync(dirPath);
  }

  /**
   * 确保配置目录存在
   */
  static ensureConfigDir(): void {
    this.ensureDir(CONFIG_DIR);
    this.ensureDir(BACKUP_DIR);
    this.ensureDir(LOG_DIR);
  }

  /**
   * 读取文件内容
   */
  static readFile(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * 写入文件内容
   */
  static writeFile(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    this.ensureDir(dir);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * 文件是否存在
   */
  static exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * 删除文件
   */
  static deleteFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * 复制文件
   */
  static copyFile(src: string, dest: string): void {
    const destDir = path.dirname(dest);
    this.ensureDir(destDir);
    fs.copyFileSync(src, dest);
  }

  /**
   * 创建备份文件
   * @param filePath 原文件路径
   * @param reason 备份原因
   * @returns 备份文件路径
   */
  static createBackup(filePath: string, reason?: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`无法备份，文件不存在: ${filePath}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const fileName = path.basename(filePath);
    const backupFileName = `${fileName}.${timestamp}.bak`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // 复制文件
    this.copyFile(filePath, backupPath);

    // 创建备份元数据
    const metadata: BackupMetadata = {
      timestamp,
      version: '1.0',
      originalPath: filePath,
      backupPath,
      reason,
    };

    const metadataPath = `${backupPath}.json`;
    this.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return backupPath;
  }

  /**
   * 清理旧备份（保留最新 N 个）
   * @param maxBackups 保留的备份数量
   */
  static cleanOldBackups(fileName: string, maxBackups: number = 5): void {
    if (!fs.existsSync(BACKUP_DIR)) return;

    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith(fileName) && f.endsWith('.bak'))
      .map((f) => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // 删除多余的备份
    files.slice(maxBackups).forEach((file) => {
      fs.unlinkSync(file.path);
      // 同时删除元数据文件
      const metadataPath = `${file.path}.json`;
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }
    });
  }

  /**
   * 从备份恢复文件
   * @param backupPath 备份文件路径
   * @param targetPath 目标文件路径（可选，默认使用备份元数据中的原始路径）
   */
  static restoreFromBackup(backupPath: string, targetPath?: string): void {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`备份文件不存在: ${backupPath}`);
    }

    // 读取备份元数据
    const metadataPath = `${backupPath}.json`;
    let target = targetPath;

    if (!target && fs.existsSync(metadataPath)) {
      const metadata: BackupMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      target = metadata.originalPath;
    }

    if (!target) {
      throw new Error('无法确定恢复目标路径');
    }

    // 在恢复前备份当前文件（如果存在）
    if (fs.existsSync(target)) {
      this.createBackup(target, '恢复前自动备份');
    }

    // 复制备份文件到目标位置
    this.copyFile(backupPath, target);
  }

  /**
   * 获取 Clash 配置文件路径（自动检测）
   */
  static detectClashConfigPath(): string | null {
    const possiblePaths = [
      // macOS ClashX
      path.join(os.homedir(), '.config/clash/config.yaml'),
      // Windows Clash for Windows
      path.join(os.homedir(), '.config/clash/profiles/config.yaml'),
      // Linux
      path.join(os.homedir(), '.config/clash/config.yaml'),
      // ClashX Pro macOS
      path.join(os.homedir(), '.config/clashX/config.yaml'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }

  /**
   * 智能扫描 ~/.config 目录下的所有 Clash YAML 配置文件
   * @returns 找到的 YAML 文件路径列表
   */
  static scanClashConfigFiles(): string[] {
    const configDir = path.join(os.homedir(), '.config');
    const clashFiles: string[] = [];

    if (!fs.existsSync(configDir)) {
      return clashFiles;
    }

    try {
      // 扫描 ~/.config 下所有可能包含 clash 的目录
      const entries = fs.readdirSync(configDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const dirName = entry.name.toLowerCase();
        // 匹配包含 clash 关键字的目录
        if (dirName.includes('clash') || dirName.includes('clashx')) {
          const clashDir = path.join(configDir, entry.name);
          const yamlFiles = this.findYamlFilesRecursive(clashDir, 3); // 最多扫描3层
          clashFiles.push(...yamlFiles);
        }
      }

      // 去重并排序
      return [...new Set(clashFiles)].sort();
    } catch (error) {
      logger.warn('扫描 Clash 配置文件失败:', error);
      return clashFiles;
    }
  }

  /**
   * 递归查找目录下的 YAML 文件
   * @param dir 目录路径
   * @param maxDepth 最大递归深度
   * @param currentDepth 当前深度
   */
  private static findYamlFilesRecursive(
    dir: string,
    maxDepth: number,
    currentDepth: number = 0
  ): string[] {
    const yamlFiles: string[] = [];

    if (currentDepth >= maxDepth) {
      return yamlFiles;
    }

    try {
      if (!fs.existsSync(dir)) {
        return yamlFiles;
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // 递归扫描子目录
          const subFiles = this.findYamlFilesRecursive(fullPath, maxDepth, currentDepth + 1);
          yamlFiles.push(...subFiles);
        } else if (entry.isFile()) {
          // 检查是否是 YAML 文件
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.yaml' || ext === '.yml') {
            yamlFiles.push(fullPath);
          }
        }
      }
    } catch (error) {
      // 忽略权限错误等
    }

    return yamlFiles;
  }

  /**
   * 列出目录中的文件
   */
  static listFiles(dirPath: string, ext?: string): string[] {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    let files = fs.readdirSync(dirPath);

    if (ext) {
      files = files.filter((f) => f.endsWith(ext));
    }

    return files.map((f) => path.join(dirPath, f));
  }
}

/**
 * 初始化配置目录
 */
export function initConfigDir(): void {
  FileUtil.ensureConfigDir();
}
