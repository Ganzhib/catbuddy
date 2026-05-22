import { MessageFrame } from '@learnbuddy/gateway-common';

/**
 * 离线消息存储接口
 * 可用 Redis List / SQLite / 本地文件等方式实�? */
export interface OfflineStorage {
  /** 缓存用户离线消息 */
  cache(userId: string, message: StoredMessage): Promise<void>;

  /** 拉取用户所有离线消息（拉取后清除） */
  flush(userId: string): Promise<StoredMessage[]>;

  /** 获取离线消息数量 */
  count(userId: string): Promise<number>;
}

export interface StoredMessage {
  msgId: string;
  from: string;
  payload?: Record<string, unknown>;
  timestamp: number;
  storedAt: number;
}

/**
 * 内存实现（开�?测试用）
 */
export class InMemoryOfflineStorage implements OfflineStorage {
  private store = new Map<string, StoredMessage[]>();

  async cache(userId: string, message: StoredMessage): Promise<void> {
    const list = this.store.get(userId) ?? [];
    list.push(message);
    this.store.set(userId, list);
  }

  async flush(userId: string): Promise<StoredMessage[]> {
    const list = this.store.get(userId) ?? [];
    this.store.delete(userId);
    return list;
  }

  async count(userId: string): Promise<number> {
    return (this.store.get(userId) ?? []).length;
  }
}
