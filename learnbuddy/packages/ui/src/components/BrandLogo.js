import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { brandAssets } from '@/lib/brand';
/** Sidebar / marketing wordmark from public/brand */
export function BrandLogo({ className = 'h-6 w-auto select-none object-contain opacity-95', alt = 'learnbuddy' }) {
    return (_jsxs("picture", { className: "block min-w-0", children: [_jsx("source", { srcSet: brandAssets.logoWebp, type: "image/webp" }), _jsx("img", { src: brandAssets.logoPng, alt: alt, className: className, draggable: false })] }));
}
//# sourceMappingURL=BrandLogo.js.map