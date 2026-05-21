/**
 * Logger — 结构化链路追踪
 * 输出格式: [HH:MM:SS] [LEVEL] [traceId] [phase] message
 */
type Level = 'DEBUG' | 'INFO' | 'ERROR';

export class Logger {
  private id = 'system';
  private phase = 'start';
  private started = Date.now();
  private enter = Date.now();

  // ═══ 生命周期 ═══

  init(id: string): this {
    this.id = id;
    this.started = Date.now();
    this.enter = this.started;
    return this;
  }

  step(phase: string): this {
    if (this.phase !== phase) {
      this.log('DEBUG', `-> ${phase}`, { ms: Date.now() - this.enter });
      this.phase = phase;
      this.enter = Date.now();
    }
    return this;
  }

  /** 标记状态机转换 */
  transition(from: string, to: string, event: string): this {
    this.log('DEBUG', `${from}:${event} -> ${to}`);
    return this;
  }

  end(msg = 'completed'): this {
    this.log('INFO', `[DONE] ${msg}`, { totalMs: Date.now() - this.started });
    return this;
  }

  // ═══ 通用记录 ═══

  info(msg: string, data?: Record<string, unknown>): this {
    this.log('INFO', msg, data);
    return this;
  }

  debug(msg: string, data?: Record<string, unknown>): this {
    this.log('DEBUG', msg, data);
    return this;
  }

  error(msg: string, err?: unknown): this {
    const data = err instanceof Error ? { error: err.message } : { error: err };
    this.log('ERROR', msg, data);
    return this;
  }

  private log(level: Level, msg: string, data?: Record<string, unknown>): void {
    const time = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(
      `[${time}] [${level}] [${this.id}] [${this.phase}] ${msg}`,
      data ? JSON.stringify(data) : '',
    );
  }
}

export const logger = new Logger();

export function trace(id: string): Logger {
  return new Logger().init(id);
}
