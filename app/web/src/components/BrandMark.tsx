interface BrandMarkProps {
  size?: number
  className?: string
  alt?: string
}

export function BrandMark({ size = 28, className = '', alt = '' }: BrandMarkProps) {
  return (
    <img
      src="/logo.png"
      alt={alt}
      width={size}
      height={size}
      className={`shrink-0 rounded-[22%] shadow-[0_1px_2px_rgba(0,0,0,0.18)] ${className}`.trim()}
    />
  )
}

export function BrandLockup({
  size = 28,
  titleClassName = 'font-display text-lg font-semibold tracking-tight text-app-text',
}: {
  size?: number
  titleClassName?: string
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <BrandMark size={size} />
      <span className={titleClassName}>EU Grantwriter</span>
    </span>
  )
}
