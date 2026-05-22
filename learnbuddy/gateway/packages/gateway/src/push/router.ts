import { MessageFrame, Connection } from '@learnbuddy/shared';

export type RouteTarget = 
  | { type: 'session'; sessionId: string }
  | { type: 'user'; userId: string }
  | { type: 'broadcast' };

export class Router {
  constructor(
    private getConnection: (sessionId: string) => Connection | undefined,
    private getConnectionsByUser: (userId: string) => Connection[],
    private getAllConnections: () => Connection[],
  ) {}

  /** 解析消息的目�?*/
  parseTarget(frame: MessageFrame): RouteTarget {
    if (frame.to === 'broadcast') {
      return { type: 'broadcast' };
    }
    // 如果 to �?"sess_" 开头，视为 sessionId
    if (frame.to.startsWith('sess_')) {
      return { type: 'session', sessionId: frame.to };
    }
    // 否则视为 userId
    return { type: 'user', userId: frame.to };
  }

  /** 路由消息 */
  async route(frame: MessageFrame): Promise<void> {
    const target = this.parseTarget(frame);

    switch (target.type) {
      case 'broadcast': {
        const allConns = this.getAllConnections();
        await Promise.all(allConns.map(c => c.send(frame)));
        break;
      }
      case 'session': {
        const conn = this.getConnection(target.sessionId);
        if (conn) {
          await conn.send(frame);
        }
        break;
      }
      case 'user': {
        const conns = this.getConnectionsByUser(target.userId);
        await Promise.all(conns.map(c => c.send(frame)));
        break;
      }
    }
  }
}
