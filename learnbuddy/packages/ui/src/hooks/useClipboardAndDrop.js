import { useCallback, useRef, useState } from "react";
/** Extract image ``File``s from a paste / drop event.
 *
 * Deliberate behaviour:
 *   - Only items whose ``kind === "file"`` and ``type`` starts with
 *     ``image/`` are returned; ``<img>`` tags inside HTML fragments are
 *     ignored (defending against remote URL fetch + XSS surfaces).
 *   - Plain text pasted alongside images is *not* consumed by this helper,
 *     so the caller can still let the textarea receive it naturally.
 */
export function extractImageFilesFromPaste(event) {
    const clipboard = event.clipboardData
        ?? event.clipboardData;
    if (!clipboard)
        return [];
    const files = [];
    for (const item of Array.from(clipboard.items)) {
        if (item.kind !== "file")
            continue;
        if (!item.type.startsWith("image/"))
            continue;
        const file = item.getAsFile();
        if (file)
            files.push(file);
    }
    return files;
}
/** Extract dropped image files, mirroring ``extractImageFilesFromPaste``. */
export function extractImageFilesFromDrop(event) {
    const dt = event.dataTransfer
        ?? event.dataTransfer;
    if (!dt)
        return [];
    const files = [];
    for (const item of Array.from(dt.files)) {
        if (item.type.startsWith("image/"))
            files.push(item);
    }
    return files;
}
/** Wire paste + drag-and-drop to a callback.
 *
 * The hook owns ``isDragging`` state and the refcount that keeps it accurate
 * across nested ``dragenter`` / ``dragleave`` events (a known DOM gotcha: the
 * text cursor inside a textarea fires ``dragleave`` on entry, flicking the
 * highlight off otherwise). */
export function useClipboardAndDrop(onImageFiles) {
    const [isDragging, setIsDragging] = useState(false);
    const dragDepth = useRef(0);
    const onPaste = useCallback((event) => {
        const files = extractImageFilesFromPaste(event);
        if (files.length === 0)
            return;
        // Consume only when an image is actually present; plain-text paste still
        // reaches the textarea unmolested.
        event.preventDefault();
        onImageFiles(files);
    }, [onImageFiles]);
    const onDragEnter = useCallback((event) => {
        if (!Array.from(event.dataTransfer.types ?? []).includes("Files"))
            return;
        event.preventDefault();
        dragDepth.current += 1;
        setIsDragging(true);
    }, []);
    const onDragOver = useCallback((event) => {
        if (!Array.from(event.dataTransfer.types ?? []).includes("Files"))
            return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    }, []);
    const onDragLeave = useCallback((event) => {
        if (!Array.from(event.dataTransfer.types ?? []).includes("Files"))
            return;
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0)
            setIsDragging(false);
    }, []);
    const onDrop = useCallback((event) => {
        dragDepth.current = 0;
        setIsDragging(false);
        const files = extractImageFilesFromDrop(event);
        if (files.length === 0)
            return;
        event.preventDefault();
        onImageFiles(files);
    }, [onImageFiles]);
    return { isDragging, onPaste, onDragEnter, onDragOver, onDragLeave, onDrop };
}
//# sourceMappingURL=useClipboardAndDrop.js.map