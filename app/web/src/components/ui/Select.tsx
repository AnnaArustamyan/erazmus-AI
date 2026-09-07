import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  triggerId?: string
  'aria-label'?: string
  autoFocus?: boolean
}

/**
 * Styled replacement for a native <select>. The closed trigger can be styled
 * with plain CSS either way, but the open menu on a native <select> is
 * unstyleable OS chrome — this uses Radix's unstyled primitives so the whole
 * thing (trigger + menu) matches the app's theme.
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Choose an option…',
  disabled,
  className = '',
  triggerId,
  'aria-label': ariaLabel,
  autoFocus,
}: SelectProps) {
  return (
    <SelectPrimitive.Root value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={triggerId}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className={`group inline-flex items-center justify-between gap-2 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-app-sm transition-all duration-150 hover:border-app-accent/50 hover:shadow-app-md focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none data-[state=open]:border-app-accent/60 ${className}`}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown
            size={14}
            className="shrink-0 text-app-text-dim transition-transform duration-150 group-data-[state=open]:rotate-180"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-72 overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-app-lg"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded-md py-2 pl-7 pr-3 text-sm text-app-text outline-none transition-colors duration-100 data-[highlighted]:bg-app-panel-2 data-[state=checked]:text-app-accent"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex items-center">
                  <Check size={13} strokeWidth={2.5} />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
