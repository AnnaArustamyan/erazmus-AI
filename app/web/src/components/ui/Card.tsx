import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'

type CardVariant = 'flat' | 'elevated'

const BASE = 'rounded-xl border border-app-border bg-app-surface px-4 py-3 transition-all duration-150 ease-out'

const VARIANT: Record<CardVariant, string> = {
  flat: '',
  elevated: 'shadow-app-sm',
}

const INTERACTIVE =
  'text-left enabled:hover:-translate-y-0.5 enabled:hover:shadow-app-md enabled:hover:border-app-accent/40 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

/** Static panel — use for grouped content that doesn't respond to interaction. */
export function Card({ variant = 'elevated', className = '', ...props }: CardProps) {
  return <div className={`${BASE} ${VARIANT[variant]} ${className}`} {...props} />
}

interface CardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CardVariant
}

/** Clickable panel — same visual language as Card, plus hover lift and a focus ring. */
export function CardButton({ variant = 'elevated', className = '', type = 'button', ...props }: CardButtonProps) {
  return (
    <button type={type} className={`${BASE} ${VARIANT[variant]} ${INTERACTIVE} w-full ${className}`} {...props} />
  )
}
