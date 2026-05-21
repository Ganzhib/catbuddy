/** Extract image ``File``s from a paste / drop event.
 *
 * Deliberate behaviour:
 *   - Only items whose ``kind === "file"`` and ``type`` starts with
 *     ``image/`` are returned; ``<img>`` tags inside HTML fragments are
 *     ignored (defending against remote URL fetch + XSS surfaces).
 *   - Plain text pasted alongside images is *not* consumed by this helper,
 *     so the caller can still let the textarea receive it naturally.
 */
export declare function extractImageFilesFromPaste(event: ClipboardEvent | React.ClipboardEvent): File[];
/** Extract dropped image files, mirroring ``extractImageFilesFromPaste``. */
export declare function extractImageFilesFromDrop(event: DragEvent | React.DragEvent): File[];
export interface UseClipboardAndDropApi {
    /** Whether a drag is currently hovering the drop zone (toggle dragover UI). */
    isDragging: boolean;
    onPaste: (event: React.ClipboardEvent) => void;
    onDragEnter: (event: React.DragEvent) => void;
    onDragOver: (event: React.DragEvent) => void;
    onDragLeave: (event: React.DragEvent) => void;
    onDrop: (event: React.DragEvent) => void;
}
/** Wire paste + drag-and-drop to a callback.
 *
 * The hook owns ``isDragging`` state and the refcount that keeps it accurate
 * across nested ``dragenter`` / ``dragleave`` events (a known DOM gotcha: the
 * text cursor inside a textarea fires ``dragleave`` on entry, flicking the
 * highlight off otherwise). */
export declare function useClipboardAndDrop(onImageFiles: (files: File[]) => void): UseClipboardAndDropApi;
//# sourceMappingURL=useClipboardAndDrop.d.ts.map