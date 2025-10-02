import CryptoJS from 'crypto-js';

/**
 * 默认加密密钥（用户应该在配置中设置自己的密钥）
 */
const DEFAULT_SECRET_KEY = 'clash-autosub-default-key-please-change';

/**
 * 加密工具类
 */
export class CryptoUtil {
  private secretKey: string;

  constructor(secretKey: string = DEFAULT_SECRET_KEY) {
    this.secretKey = secretKey;
  }

  /**
   * 加密字符串
   */
  encrypt(plainText: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(plainText, this.secretKey);
      return encrypted.toString();
    } catch (error) {
      throw new Error(`加密失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 解密字符串
   */
  decrypt(cipherText: string): string {
    try {
      const decrypted = CryptoJS.AES.decrypt(cipherText, this.secretKey);
      const plainText = decrypted.toString(CryptoJS.enc.Utf8);

      if (!plainText) {
        throw new Error('解密结果为空，可能密钥错误');
      }

      return plainText;
    } catch (error) {
      throw new Error(`解密失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 加密对象（转为 JSON 后加密）
   */
  encryptObject<T>(obj: T): string {
    const jsonStr = JSON.stringify(obj);
    return this.encrypt(jsonStr);
  }

  /**
   * 解密对象（解密后解析 JSON）
   */
  decryptObject<T>(cipherText: string): T {
    const jsonStr = this.decrypt(cipherText);
    return JSON.parse(jsonStr) as T;
  }

  /**
   * 生成哈希值（用于密码或数据完整性校验）
   */
  hash(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  /**
   * 验证哈希值
   */
  verifyHash(data: string, hashValue: string): boolean {
    return this.hash(data) === hashValue;
  }
}

/**
 * 导出默认实例
 */
export const crypto = new CryptoUtil();

/**
 * 辅助函数：加密凭证对象
 */
export function encryptCredentials(credentials: {
  cookies: string;
  localStorage: string;
  sessionStorage: string;
  tokens: string;
}): {
  cookies: string;
  localStorage: string;
  sessionStorage: string;
  tokens: string;
} {
  return {
    cookies: crypto.encrypt(credentials.cookies),
    localStorage: crypto.encrypt(credentials.localStorage),
    sessionStorage: crypto.encrypt(credentials.sessionStorage),
    tokens: crypto.encrypt(credentials.tokens),
  };
}

/**
 * 辅助函数：解密凭证对象
 */
export function decryptCredentials(encryptedCredentials: {
  cookies: string;
  localStorage: string;
  sessionStorage: string;
  tokens: string;
}): {
  cookies: string;
  localStorage: string;
  sessionStorage: string;
  tokens: string;
} {
  return {
    cookies: crypto.decrypt(encryptedCredentials.cookies),
    localStorage: crypto.decrypt(encryptedCredentials.localStorage),
    sessionStorage: crypto.decrypt(encryptedCredentials.sessionStorage),
    tokens: crypto.decrypt(encryptedCredentials.tokens),
  };
}
