import { brandAssets } from '@/lib/brand'

type BrandLogoProps = {
  className?: string
  alt?: string
}

/** Sidebar / marketing wordmark from public/brand */
export function BrandLogo({ className = 'h-6 w-auto select-none object-contain opacity-95', alt = 'learnbuddy' }: BrandLogoProps) {
  return (
    <picture className="block min-w-0">
      <source srcSet={brandAssets.logoWebp} type="image/webp" />
      <img src={brandAssets.logoPng} alt={alt} className={className} draggable={false} />
    </picture>
  )
}
