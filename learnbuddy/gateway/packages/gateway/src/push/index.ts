import { createGateway, GatewayConfig } from './server';

const config: GatewayConfig = {
  port: parseInt(process.env.PORT || '8080', 10),
  host: process.env.HOST || '0.0.0.0',
  auth: {
    secret: process.env.AUTH_SECRET || 'dev-secret',
    tokenExpiryMs: 24 * 60 * 60 * 1000, // 24h
  },
};

createGateway(config).catch((err) => {
  console.error('Failed to start gateway:', err);
  process.exit(1);
});
