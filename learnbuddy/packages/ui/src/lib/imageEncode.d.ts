/**
 * Main-thread client for the image encoder Worker.
 *
 * Lazily boots a single ``imageEncode.worker`` and multiplexes requests onto
 * it by a random request id. Falls back to an inline call when the Worker
 * can't be constructed (tests, ancient browsers) so the Composer always has a
 * working path.
 */
import { type EncodeResponse } from "@/workers/imageEncode.worker";
export type { EncodeResponse, EncodeSuccess, EncodeFailure } from "@/workers/imageEncode.worker";
export { TARGET_MAX_BYTES } from "@/workers/imageEncode.worker";
/** Encode ``file`` off the main thread when possible. Always resolves — errors
 * are returned as ``{ok: false, reason}`` — so callers can render inline
 * validation without wrapping in try/catch. */
export declare function encodeImage(file: File): Promise<EncodeResponse>;
/** Release the singleton Worker (tests / teardown). */
export declare function disposeImageEncoder(): void;
//# sourceMappingURL=imageEncode.d.ts.map