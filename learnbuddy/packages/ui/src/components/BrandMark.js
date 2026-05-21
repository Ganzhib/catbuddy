import { jsx as _jsx } from "react/jsx-runtime";
import { brandAssets } from '@/lib/brand';
/** Square cat mark (favicon-sized) from public/brand */
export function BrandMark({ className = 'h-10 w-10 object-contain', alt = 'learnbuddy' }) {
    return _jsx("img", { src: brandAssets.icon, alt: alt, className: className, draggable: false });
}
//# sourceMappingURL=BrandMark.js.map