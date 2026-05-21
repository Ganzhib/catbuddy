import type { UIImage } from "@learnbuddy/shared";
interface ImageLightboxProps {
    images: UIImage[];
    index: number | null;
    onIndexChange: (index: number) => void;
    onOpenChange: (open: boolean) => void;
}
/**
 * Modal image viewer. Uses the Radix Dialog primitives directly so we can
 * fill the viewport (the shared `DialogContent` wrapper caps at max-w-lg,
 * which is much too small for a photo preview).
 *
 * Implementation notes:
 * - `translate3d` + `will-change: transform` promote the image to a GPU
 *   compositing layer so open/swap stays at 60 FPS on long threads.
 * - Adjacent images are rendered in hidden `<img>` tags so the browser
 *   decodes them eagerly; pressing left/right feels instant.
 * - Radix handles `Escape` + focus trapping; we only wire up ←/→ + Home/End.
 * - Respects `prefers-reduced-motion` by dropping the fade + zoom-in
 *   keyframes via `motion-reduce:*` variants.
 */
export declare function ImageLightbox({ images, index, onIndexChange, onOpenChange, }: ImageLightboxProps): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=ImageLightbox.d.ts.map