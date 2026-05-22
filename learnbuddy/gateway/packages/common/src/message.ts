import { v4 as uuidv4 } from 'uuid';
import { MessageFrame, MessageType } from './types.js';

export function createMessageFrame(
  type: MessageType,
  from: string,
  to: string,
  payload?: Record<string, unknown>,
  ttl?: number,
): MessageFrame {
  return {
    type,
    id: uuidv4(),
    from,
    to,
    payload,
    timestamp: Date.now(),
    ...(ttl !== undefined ? { ttl } : {}),
  };
}

export function createPing(from: string): MessageFrame {
  return createMessageFrame('ping', from, 'gateway');
}

export function createPong(from: string): MessageFrame {
  return createMessageFrame('pong', from, '');
}

export function createAck(
  from: string,
  to: string,
  ackMsgId: string,
  status: 'ok' | 'failed',
  error?: string,
): MessageFrame {
  return {
    type: 'ack',
    id: uuidv4(),
    from,
    to,
    payload: { ackMsgId, status, ...(error ? { error } : {}) },
    timestamp: Date.now(),
  };
}

export function validateFrame(frame: unknown): frame is MessageFrame {
  if (!frame || typeof frame !== 'object') return false;
  const f = frame as Record<string, unknown>;
  return (
    typeof f.type === 'string' &&
    typeof f.id === 'string' &&
    typeof f.from === 'string' &&
    typeof f.to === 'string' &&
    typeof f.timestamp === 'number'
  );
}
