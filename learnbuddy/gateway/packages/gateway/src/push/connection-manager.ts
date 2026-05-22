import { EventEmitter } from 'events';
import { Connection, ConnectionStatus, ConnectionType, ConnectionStats } from '@learnbuddy/gateway-common';

export class ConnectionManager extends EventEmitter {
  private sessions = new Map<string, Connection>();
  private userSessions = new Map<string, Set<string>>();

  /** 注册新连�?*/
  register(conn: Connection): void {
    this.sessions.set(conn.id, conn);

    const userSet = this.userSessions.get(conn.userId) ?? new Set();
    userSet.add(conn.id);
    this.userSessions.set(conn.userId, userSet);

    this.emit('connection:register', conn);
  }

  /** 注销连接 */
  unregister(sessionId: string): void {
    const conn = this.sessions.get(sessionId);
    if (!conn) return;

    this.sessions.delete(sessionId);

    const userSet = this.userSessions.get(conn.userId);
    if (userSet) {
      userSet.delete(sessionId);
      if (userSet.size === 0) {
        this.userSessions.delete(conn.userId);
      }
    }

    this.emit('connection:unregister', conn);
  }

  /** 获取指定 session */
  getBySession(sessionId: string): Connection | undefined {
    return this.sessions.get(sessionId);
  }

  /** 获取用户的所有连�?*/
  getByUser(userId: string): Connection[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds || sessionIds.size === 0) return [];

    const results: Connection[] = [];
    for (const sid of sessionIds) {
      const conn = this.sessions.get(sid);
      if (conn) results.push(conn);
    }
    return results;
  }

  /** 更新连接状�?*/
  updateStatus(sessionId: string, status: ConnectionStatus): void {
    const conn = this.sessions.get(sessionId);
    if (conn) {
      conn.status = status;
      this.emit('connection:status', sessionId, status);
    }
  }

  /** 更新心跳时间 */
  updateHeartbeat(sessionId: string): void {
    const conn = this.sessions.get(sessionId);
    if (conn) {
      conn.lastHeartbeat = Date.now();
    }
  }

  /** 向用户的所有连接发送消�?*/
  async sendToUser(userId: string, frame: unknown): Promise<void> {
    const conns = this.getByUser(userId);
    await Promise.all(conns.map(c => c.send(frame as any)));
  }

  /** 获取统计信息 */
  getStats(): ConnectionStats {
    let web = 0;
    let desktop = 0;
    let active = 0;
    let idle = 0;

    for (const conn of this.sessions.values()) {
      if (conn.type === 'web') web++;
      else desktop++;
      if (conn.status === 'active') active++;
      else if (conn.status === 'idle') idle++;
    }

    return {
      total: this.sessions.size,
      web,
      desktop,
      active,
      idle,
    };
  }

  /** 获取所有在线用户数 */
  get onlineUserCount(): number {
    return this.userSessions.size;
  }
}
