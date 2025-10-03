import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { logger } from '../utils/logger.js';
import { StoredCredentials } from '../types/index.js';

const CREDENTIAL_DIR = path.join(os.homedir(), '.autosub', 'credentials');

export function ensureCredentialDir(): void {
  fs.ensureDirSync(CREDENTIAL_DIR);
}

function credentialFilePath(siteId: string): string {
  ensureCredentialDir();
  return path.join(CREDENTIAL_DIR, `${siteId}.json`);
}

export async function readCredentials(siteId: string): Promise<StoredCredentials | null> {
  try {
    const file = credentialFilePath(siteId);
    if (!(await fs.pathExists(file))) {
      return null;
    }
    const content = await fs.readFile(file, 'utf-8');
    const data = JSON.parse(content);
    if (!data.updatedAt) {
      data.updatedAt = new Date().toISOString();
    }
    return data as StoredCredentials;
  } catch (error) {
    logger.warn(`读取凭证文件失败(${siteId}): ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export function writeCredentials(siteId: string, credentials: StoredCredentials): string {
  try {
    const file = credentialFilePath(siteId);
    const payload = {
      ...credentials,
      updatedAt: credentials.updatedAt ?? new Date().toISOString(),
    };
    fs.writeJsonSync(file, payload, { spaces: 2 });
    return file;
  } catch (error) {
    throw new Error(
      `写入凭证文件失败(${siteId}): ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function deleteCredentials(siteId: string): void {
  try {
    const file = credentialFilePath(siteId);
    if (fs.existsSync(file)) {
      fs.removeSync(file);
    }
  } catch (error) {
    logger.warn(`删除凭证文件失败(${siteId}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function getCredentialFilePath(siteId: string): string {
  return credentialFilePath(siteId);
}
