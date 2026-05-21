import { useCallback, useEffect, useRef, useState } from "react";
import { encodeImage } from "@/lib/imageEncode";
export const MAX_IMAGES_PER_MESSAGE = 4;
/** MIME whitelist — mirrors the server's and the ``<input accept>`` attr. */
const ACCEPTED_MIMES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
]);
function uuid() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function mapEncodeFailure(reason) {
    switch (reason) {
        case "invalid_mime":
        case "magic_mismatch":
            return "magic_mismatch";
        case "too_large_after_normalize":
            return "too_large";
        case "io":
            return "io";
        case "decode_failed":
        default:
            return "decode_failed";
    }
}
/** Manage the lifecycle of images attached to the Composer.
 *
 * Responsibilities in one place:
 *   - validation (MIME whitelist, count cap)
 *   - blob URL creation + revocation
 *   - Worker orchestration
 *   - focus bookkeeping so keyboard delete doesn't strand the user
 */
export function useAttachedImages() {
    const [images, setImages] = useState([]);
    // Ref mirror so ``enqueue`` can see the authoritative length when invoked
    // multiple times in a single tick (rapid file selection, drag of many
    // files, paste storms). ``state`` is stale for that second + call.
    const imagesRef = useRef([]);
    imagesRef.current = images;
    const setEntry = useCallback((id, patch) => {
        setImages((prev) => {
            const next = prev.map((img) => (img.id === id ? { ...img, ...patch } : img));
            imagesRef.current = next;
            return next;
        });
    }, []);
    const enqueue = useCallback((files) => {
        const rejected = [];
        const toAdd = [];
        let slot = MAX_IMAGES_PER_MESSAGE - imagesRef.current.length;
        for (const file of files) {
            if (!ACCEPTED_MIMES.has(file.type)) {
                rejected.push({ file, reason: "unsupported_type" });
                continue;
            }
            if (slot <= 0) {
                rejected.push({ file, reason: "too_many_images" });
                continue;
            }
            slot -= 1;
            toAdd.push({
                id: uuid(),
                file,
                previewUrl: URL.createObjectURL(file),
                status: "encoding",
            });
        }
        if (toAdd.length > 0) {
            const next = [...imagesRef.current, ...toAdd];
            imagesRef.current = next;
            setImages(next);
            // Fire the Worker after the commit so chips render first (good INP).
            for (const entry of toAdd) {
                queueMicrotask(() => {
                    encodeImage(entry.file).then((result) => {
                        if (result.ok) {
                            setEntry(entry.id, {
                                status: "ready",
                                dataUrl: result.dataUrl,
                                encodedBytes: result.bytes,
                                normalized: result.normalized,
                            });
                        }
                        else {
                            setEntry(entry.id, {
                                status: "error",
                                error: mapEncodeFailure(result.reason),
                            });
                        }
                    }, () => {
                        setEntry(entry.id, {
                            status: "error",
                            error: "decode_failed",
                        });
                    });
                });
            }
        }
        return { rejected };
    }, [setEntry]);
    const remove = useCallback((id) => {
        let nextFocusId = null;
        setImages((prev) => {
            const idx = prev.findIndex((img) => img.id === id);
            if (idx === -1)
                return prev;
            const target = prev[idx];
            try {
                URL.revokeObjectURL(target.previewUrl);
            }
            catch {
                // No-op: previewUrl revocation is best-effort.
            }
            const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
            imagesRef.current = next;
            // Prefer moving focus to the chip at the same index, else previous.
            const candidate = next[idx] ?? next[idx - 1];
            nextFocusId = candidate?.id ?? null;
            return next;
        });
        return { nextFocusId };
    }, []);
    const clear = useCallback(() => {
        setImages((prev) => {
            for (const img of prev) {
                try {
                    URL.revokeObjectURL(img.previewUrl);
                }
                catch {
                    // revoke is best-effort
                }
            }
            imagesRef.current = [];
            return [];
        });
    }, []);
    // Final safety net: revoke any outstanding blob URLs on unmount. Safe
    // under StrictMode double-invoke because revoked blob URLs are only
    // referenced from in-hook chip state, which is rebuilt on remount.
    useEffect(() => {
        return () => {
            for (const img of imagesRef.current) {
                try {
                    URL.revokeObjectURL(img.previewUrl);
                }
                catch {
                    // best-effort cleanup on unmount
                }
            }
        };
    }, []);
    const encoding = images.some((img) => img.status === "encoding");
    const full = images.length >= MAX_IMAGES_PER_MESSAGE;
    return { images, enqueue, remove, clear, encoding, full };
}
//# sourceMappingURL=useAttachedImages.js.map