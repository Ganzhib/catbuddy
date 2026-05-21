/**
 * Main-thread client for the image encoder Worker.
 *
 * Lazily boots a single ``imageEncode.worker`` and multiplexes requests onto
 * it by a random request id. Falls back to an inline call when the Worker
 * can't be constructed (tests, ancient browsers) so the Composer always has a
 * working path.
 */
import { encodeImageInWorker, } from "@/workers/imageEncode.worker";
export { TARGET_MAX_BYTES } from "@/workers/imageEncode.worker";
let worker = null;
let bootAttempted = false;
const pending = new Map();
function bootWorker() {
    if (bootAttempted)
        return worker;
    bootAttempted = true;
    if (typeof Worker === "undefined")
        return null;
    try {
        worker = new Worker(new URL("@/workers/imageEncode.worker.ts", import.meta.url), { type: "module" });
        worker.addEventListener("message", (ev) => {
            const entry = pending.get(ev.data.id);
            if (!entry)
                return;
            pending.delete(ev.data.id);
            entry.resolve(ev.data);
        });
        worker.addEventListener("error", (ev) => {
            // Cancel every in-flight request on a Worker crash.
            for (const [, entry] of pending) {
                entry.reject(new Error(`image encoder worker error: ${ev.message}`));
            }
            pending.clear();
            worker?.terminate();
            worker = null;
        });
        return worker;
    }
    catch {
        worker = null;
        return null;
    }
}
function newId() {
    // ``crypto.randomUUID`` is widely available; fall back to Math.random if not.
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
/** Encode ``file`` off the main thread when possible. Always resolves — errors
 * are returned as ``{ok: false, reason}`` — so callers can render inline
 * validation without wrapping in try/catch. */
export async function encodeImage(file) {
    const id = newId();
    const w = bootWorker();
    if (!w) {
        // Inline fallback: same logic, just on the main thread.
        return encodeImageInWorker({ id, file });
    }
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        try {
            w.postMessage({ id, file });
        }
        catch (err) {
            pending.delete(id);
            reject(err instanceof Error ? err : new Error(String(err)));
        }
    });
}
/** Release the singleton Worker (tests / teardown). */
export function disposeImageEncoder() {
    if (worker) {
        worker.terminate();
        worker = null;
    }
    bootAttempted = false;
    for (const [, entry] of pending) {
        entry.reject(new Error("image encoder disposed"));
    }
    pending.clear();
}
//# sourceMappingURL=imageEncode.js.map