/** Lifecycle stages of one attachment:
 *
 * - ``encoding``  — posted to the Worker; chip shows a spinner
 * - ``ready``     — ``dataUrl`` available; safe to submit
 * - ``error``     — validation / decode failure; chip shows inline error
 */
export type AttachmentStatus = "encoding" | "ready" | "error";
export interface AttachedImage {
    id: string;
    file: File;
    /** Optimistic ``blob:`` preview URL; revoked on ``remove`` / ``clear`` /
     * unmount. */
    previewUrl: string;
    status: AttachmentStatus;
    /** Populated when ``status === "ready"``. */
    dataUrl?: string;
    /** Size of the final encoded payload (base64 bytes decoded). */
    encodedBytes?: number;
    /** Whether the Worker re-encoded the image to hit the size budget. */
    normalized?: boolean;
    /** Human-readable validation / encoding error when ``status === "error"``. */
    error?: AttachmentError;
}
/** Machine-readable rejection reasons surfaced as inline chip errors.
 *
 * Callers localize these via the ``composer.imageRejected.*`` i18n table. */
export type AttachmentError = "unsupported_type" | "too_many_images" | "magic_mismatch" | "decode_failed" | "too_large" | "io";
export declare const MAX_IMAGES_PER_MESSAGE = 4;
export interface UseAttachedImagesApi {
    images: AttachedImage[];
    /** Enqueue new files. Returns the list of rejected files so the caller can
     * surface inline errors. Files rejected client-side (wrong MIME, limit) are
     * *not* added to ``images`` — only recoverable encoding failures show up as
     * error chips. */
    enqueue: (files: Iterable<File>) => {
        rejected: Array<{
            file: File;
            reason: AttachmentError;
        }>;
    };
    remove: (id: string) => {
        nextFocusId: string | null;
    };
    /** Revoke every staged blob URL and drop all attachments. Called after a
     * successful submit — the optimistic bubble holds onto an independent
     * ``data:`` URL so tearing down blob previews here is safe. */
    clear: () => void;
    /** ``true`` when at least one image is still encoding — Send should wait. */
    encoding: boolean;
    /** ``true`` when we've hit ``MAX_IMAGES_PER_MESSAGE``. */
    full: boolean;
}
/** Manage the lifecycle of images attached to the Composer.
 *
 * Responsibilities in one place:
 *   - validation (MIME whitelist, count cap)
 *   - blob URL creation + revocation
 *   - Worker orchestration
 *   - focus bookkeeping so keyboard delete doesn't strand the user
 */
export declare function useAttachedImages(): UseAttachedImagesApi;
//# sourceMappingURL=useAttachedImages.d.ts.map