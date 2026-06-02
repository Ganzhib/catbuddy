export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: Record<string, unknown> = { ok: false, error: message },
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export function unauthorized(
  body: string | Record<string, unknown> = { ok: false, error: 'unauthorized' },
): never {
  const payload = typeof body === 'string' ? { ok: false, error: body } : body
  throw new HttpError(401, 'unauthorized', payload)
}

export function forbidden(message = 'forbidden'): never {
  throw new HttpError(403, message, { ok: false, error: message })
}

export function conflict(message: string): never {
  throw new HttpError(409, message, { ok: false, error: message })
}
