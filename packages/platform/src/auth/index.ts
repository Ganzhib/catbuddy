export { BootstrapAuthRequired } from './errors'
export { requiresEmailLogin, requiresWebLogin } from './policy'
export {
  clearAuthToken,
  hasAuthToken,
  loadAuthEmail,
  loadAuthToken,
  saveAuthEmail,
  saveAuthToken,
} from './session'
export {
  emailPrefixFromEmail,
  resolveAuthEmail,
  resolveAuthEmailPrefix,
} from './email-utils'
export { emailFromGatewayToken } from './jwt-email'
export { requestEmailCode, verifyEmailCode } from './email-client'
export {
  loginWithPassword,
  registerWithPassword,
  requestRegister,
  verifyRegister,
} from './password-client'
export type { AuthTokenResponse, RegisterPendingResponse } from './password-client'
export type { OtpDelivery, RequestEmailCodeResponse } from './email-client'
