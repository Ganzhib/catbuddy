export { BootstrapAuthRequired } from './errors'
export { requiresEmailLogin, requiresWebLogin } from './policy'
export { clearAuthToken, hasAuthToken, loadAuthToken, saveAuthToken } from './session'
export { requestEmailCode, verifyEmailCode } from './email-client'
export {
  loginWithPassword,
  registerWithPassword,
  requestRegister,
  verifyRegister,
} from './password-client'
export type { AuthTokenResponse, RegisterPendingResponse } from './password-client'
export type { OtpDelivery, RequestEmailCodeResponse } from './email-client'
