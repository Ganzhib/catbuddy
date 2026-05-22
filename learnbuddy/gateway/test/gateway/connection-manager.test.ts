import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionManager } from '../../packages/gateway/src/push/connection-manager.js';
import {
  Connection,
  ConnectionType,
  GatewayConnectionStatus,
} from '@learnbuddy/shared';

function createMockConn(id: string, userId: string, type: ConnectionType): Connection {
  return {
    id,
    userId,
    type,
    status: 'active',
    gatewayId: 'gw-1',
    lastHeartbeat: Date.now(),
    metadata: {},
    send: async () => {},
    close: async () => {},
  };
}

describe('ConnectionManager', () => {
  let cm: ConnectionManager;

  beforeEach(() => {
    cm = new ConnectionManager();
  });

  it('should register a connection', () => {
    const conn = createMockConn('sess_1', 'user_1', 'web');
    cm.register(conn);

    expect(cm.getBySession('sess_1')).toBe(conn);
    expect(cm.getStats().total).toBe(1);
    expect(cm.getStats().web).toBe(1);
  });

  it('should unregister a connection', () => {
    const conn = createMockConn('sess_1', 'user_1', 'web');
    cm.register(conn);
    cm.unregister('sess_1');

    expect(cm.getBySession('sess_1')).toBeUndefined();
    expect(cm.getStats().total).toBe(0);
  });

  it('should find connections by user', () => {
    const conn1 = createMockConn('sess_1', 'user_1', 'web');
    const conn2 = createMockConn('sess_2', 'user_1', 'desktop');
    cm.register(conn1);
    cm.register(conn2);

    const userConns = cm.getByUser('user_1');
    expect(userConns).toHaveLength(2);
  });

  it('should update status', () => {
    const conn = createMockConn('sess_1', 'user_1', 'web');
    cm.register(conn);

    cm.updateStatus('sess_1', 'idle');
    expect(conn.status).toBe('idle');
    expect(cm.getStats().idle).toBe(1);
  });

  it('should track online users', () => {
    const conn1 = createMockConn('sess_1', 'user_1', 'web');
    const conn2 = createMockConn('sess_2', 'user_2', 'desktop');
    cm.register(conn1);
    cm.register(conn2);

    expect(cm.onlineUserCount).toBe(2);

    cm.unregister('sess_1');
    expect(cm.onlineUserCount).toBe(1);
  });
});
