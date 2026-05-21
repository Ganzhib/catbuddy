import type { BootstrapResponse } from '@learnbuddy/shared';
export { loadSavedSecret, saveSecret, clearSavedSecret } from './secrets';
export declare function fetchBootstrapHttp(baseUrl?: string, secret?: string): Promise<BootstrapResponse>;
export declare function deriveWsUrlHttp(wsPath: string, token: string): string;
//# sourceMappingURL=http-bootstrap.d.ts.map