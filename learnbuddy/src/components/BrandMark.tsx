import { brandAssets } from '@/lib/brand'

type BrandMarkProps = {
  className?: string
  alt?: string
}

/** Square cat mark (favicon-sized) from public/brand */
export function BrandMark({ className = 'h-10 w-10 object-contain', alt = 'learnbuddy' }: BrandMarkProps) {
  return <img src={brandAssets.icon} alt={alt} className={className} draggable={false} />
}
