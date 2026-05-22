import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { ConnectionManager } from './connection-manager';
import { Router } from './router';
import { HeartbeatMonitor } from './heartbeat';
import { ReliableDelivery } from './reliable-delivery';
import { InMemoryOfflineStorage } from './offline-storage';
import { Authenticator } from './auth';
import { Connection, ConnectionType, MessageFrame } from '@learnbuddy/shared';
import { validateFrame, createPong } from '@learnbuddy/shared';

export interface GatewayConfig {
  port: number;
  host: string;
  auth: { secret: string; tokenExpiryMs: number };
}

export async function createGateway(config: GatewayConfig) {
  const app = Fastify({ logger: true });

  // 注册 WebSocket 插件
  await app.register(fastifyWebsocket);

  // 初始化模�?  const connManager = new ConnectionManager();
  const offlineStorage = new InMemoryOfflineStorage();
  const authenticator = new Authenticator(config.auth);
  const delivery = new ReliableDelivery(connManager);
  const router = new Router(
    (sid) => connManager.getBySession(sid),
    (uid) => connManager.getByUser(uid),
    () => {
      const stats = connManager.getStats();
      return []; // 实际应返�?Connection 数组
    },
  );

  const heartMonitor = new HeartbeatMonitor(connManager, {
    web: {
      interval: 30_000,
      maxMissed: 3,
      onTimeout: async (sessionId) => {
        connManager.unregister(sessionId);
        heartMonitor.stop(sessionId);
      },
    },
    desktop: {
      interval: 60_000,
      maxMissed: 3,
      onTimeout: async (sessionId) => {
        connManager.updateStatus(sessionId, 'idle');
      },
    },
  });

  // 心跳超时日志
  heartMonitor.on('heartbeat:timeout', (sessionId) => {
    app.log.warn({ sessionId }, 'Heartbeat timeout, connection closed');
  });

  // === WebSocket 端点 ===
  app.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (socket, req) => {
      const connType: ConnectionType = 
        (req.headers['x-client-type'] as string) === 'desktop' ? 'desktop' : 'web';

      let sessionId: string | null = null;

      socket.on('message', async (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          const frame = data as MessageFrame;

          // 处理鉴权
          if (frame.type === 'auth') {
            const token = frame.payload?.token as string;
            const result = await authenticator.authenticate(token, connType);
            if (!result.ok) {
              socket.send(JSON.stringify({
                type: 'auth', id: frame.id, from: 'gateway', to: frame.from,
                payload: { status: 'failed', error: result.error },
                timestamp: Date.now(),
              }));
              return;
            }

            sessionId = result.sessionId!;
            const conn: Connection = {
              id: sessionId,
              userId: result.userId!,
              type: connType,
              status: 'active',
              gatewayId: 'gw-1',
              lastHeartbeat: Date.now(),
              metadata: {},
              send: (f) => Promise.resolve(socket.send(JSON.stringify(f))),
              close: () => Promise.resolve(socket.close()),
            };

            connManager.register(conn);
            heartMonitor.start(sessionId);

            socket.send(JSON.stringify({
              type: 'auth', id: frame.id, from: 'gateway', to: frame.from,
              payload: { status: 'ok', sessionId },
              timestamp: Date.now(),
            }));
            return;
          }

          // 至少需要鉴权通过
          if (!sessionId) {
            socket.send(JSON.stringify({
              type: 'push', id: frame.id, from: 'gateway', to: frame.from,
              payload: { error: 'Not authenticated' },
              timestamp: Date.now(),
            }));
            return;
          }

          // 处理心跳
          if (frame.type === 'ping') {
            heartMonitor.heartbeat(sessionId);
            socket.send(JSON.stringify(createPong('gateway')));
            return;
          }

          // 处理 ACK
          if (frame.type === 'ack') {
            delivery.handleAck(frame);
            return;
          }

          // 处理业务消息
          if (frame.type === 'push') {
            await router.route(frame);
            return;
          }
        } catch (err) {
          app.log.error({ err }, 'Message handling error');
        }
      });

      socket.on('close', () => {
        if (sessionId) {
          heartMonitor.stop(sessionId);
          connManager.unregister(sessionId);
        }
      });
    });
  });

  // === Admin API ===
  app.get('/admin/stats', async () => {
    const stats = connManager.getStats();
    return {
      ...stats,
      onlineUsers: connManager.onlineUserCount,
      pendingAcks: delivery.pendingCount,
    };
  });

  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  // 启动
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Gateway started on ${config.host}:${config.port}`);

  return app;
}
