export class BootstrapAuthRequired extends Error {
  readonly requires_auth = true
  constructor() {
    super('auth_required')
    this.name = 'BootstrapAuthRequired'
  }
}
