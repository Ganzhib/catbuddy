/**
 * Off-main-thread image encoder.
 *
 * Accepts a ``File``, validates it via magic bytes (ignoring the extension to
 * defeat rename-based spoofs), and either passes through or *normalizes* the
 * bytes so the resulting base64 data URL stays ≤ ``TARGET_MAX_BYTES``. The
 * normalization path uses ``createImageBitmap`` + ``OffscreenCanvas`` so the
 * full decode/resize/re-encode cycle never blocks the UI thread.
 *
 * Output contract:
 *   ``{ok: true, dataUrl, mime, bytes, origBytes, normalized}`` on success, or
 *   ``{ok: false, reason}`` for every recoverable failure — magic-bytes
 *   mismatch, unsupported MIME, decode error, or a post-normalization payload
 *   that *still* exceeds the budget (extreme aspect ratios).
 */
export type EncodeInput = {
    id: string;
    file: File;
};
export type EncodeSuccess = {
    id: string;
    ok: true;
    dataUrl: string;
    mime: string;
    bytes: number;
    origBytes: number;
    /** True iff the Worker re-encoded the image to hit the size budget. */
    normalized: boolean;
};
export type EncodeFailure = {
    id: string;
    ok: false;
    reason: "invalid_mime" | "magic_mismatch" | "too_large_after_normalize" | "decode_failed" | "io";
};
export type EncodeResponse = EncodeSuccess | EncodeFailure;
/** Upper bound for the final base64-decoded payload. Matches the server-side
 * safeguard (8 MB) minus safety margin; anything this function yields should
 * safely pass ``_MAX_IMAGE_BYTES`` on the server. */
export declare const TARGET_MAX_BYTES: number;
/** Sniff the first 12 bytes; returns the canonical MIME or ``null``.
 *
 * Covers PNG, JPEG, WebP, GIF — the same whitelist honoured by the server.
 */
export declare function sniffImageMime(bytes: Uint8Array): string | null;
export declare function encodeImageInWorker(input: EncodeInput): Promise<EncodeResponse>;
//# sourceMappingURL=imageEncode.worker.d.ts.map