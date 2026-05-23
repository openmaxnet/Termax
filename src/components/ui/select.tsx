import * as React from "react"
import { cn } from "@/lib/utils"
import { useClickOutside } from "@/hooks/useClickOutside"
import { clampToViewport } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon } from "lucide-react"

// ═══ 类型 ═══

export interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode
}

export interface SelectValueProps {
  placeholder?: string
}

export interface SelectContentProps {
  children: React.ReactNode
  className?: string
}

export interface SelectItemProps {
  value: string
  disabled?: boolean
  children: React.ReactNode
}

// ═══ 上下文 ═══

interface SelectContextValue {
  value: string
  onChange: (v: string) => void
  open: boolean
  setOpen: (v: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const Ctx = React.createContext<SelectContextValue>(null!)

// ═══ 根组件 ═══

function Select({ value: controlledValue, defaultValue, onValueChange, children }: SelectProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? '')
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  const value = controlledValue ?? internal
  const onChange = (v: string) => {
    if (controlledValue === undefined) setInternal(v)
    onValueChange?.(v)
    setOpen(false)
  }

  return (
    <Ctx.Provider value={{ value, onChange, open, setOpen, triggerRef }}>
      {children}
    </Ctx.Provider>
  )
}

// ═══ Trigger ═══

function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  const { open, setOpen, triggerRef } = React.useContext(Ctx)

  return (
    <button
      ref={triggerRef}
      type="button"
      role="combobox"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={cn(
        "flex w-full items-center justify-between gap-2 h-9 rounded-(--tx-radius-md) border border-(--tx-border-light) bg-transparent px-3 py-2 text-sm text-(--tx-text-primary) whitespace-nowrap transition-colors outline-none select-none cursor-pointer hover:bg-(--tx-bg-hover) focus-visible:border-(--tx-border-focus) focus-visible:ring-2 focus-visible:ring-(--tx-border-focus)/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className={cn("pointer-events-none size-4 shrink-0 text-(--tx-text-tertiary) transition-transform duration-150", open && "rotate-180")} />
    </button>
  )
}

// ═══ Value ═══

function SelectValue({ placeholder: _placeholder }: SelectValueProps) {
  return null
}

// ═══ Content (弹出层) ═══

function SelectContent({ children, className }: SelectContentProps) {
  return <SelectContentInner className={className}>{children}</SelectContentInner>
}

function SelectContentInner({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open, setOpen, triggerRef } = React.useContext(Ctx)
  const popupRef = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null)

  useClickOutside(popupRef, () => setOpen(false), open)

  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, setOpen, triggerRef])

  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popupRef.current) return
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const popupRect = popupRef.current.getBoundingClientRect()
    const clamped = clampToViewport(triggerRect.left, triggerRect.bottom + 4, popupRect.width, popupRect.height, 4)
    setPos({ left: clamped.left, top: clamped.top })
  }, [open])

  if (!open) return null

  const triggerRect = triggerRef.current?.getBoundingClientRect()
  if (!triggerRect) return null

  return (
    <div
      ref={popupRef}
      role="listbox"
      style={{
        position: 'fixed',
        left: pos?.left ?? triggerRect.left,
        top: pos?.top ?? triggerRect.bottom + 4,
        zIndex: 60,
        minWidth: triggerRect.width,
        maxHeight: 240,
        overflowY: 'auto',
        animation: 'tx-scale-in 0.12s ease-out',
      }}
      className={cn(
        "flex flex-col gap-0.5 rounded-(--tx-radius-md) bg-(--tx-bg-elevated) text-(--tx-text-primary) p-1.5 shadow-(--tx-shadow-md) ring-1 ring-(--tx-border-light)",
        className
      )}
    >
      {children}
    </div>
  )
}

// ═══ Item ═══

function SelectItem({ value, disabled, children }: SelectItemProps) {
  const ctx = React.useContext(Ctx)
  const isSelected = ctx.value === value

  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      onClick={() => { if (!disabled) ctx.onChange(value); }}
      className={cn(
        "relative flex items-center gap-2 rounded-(--tx-radius-md) py-2 pr-8 pl-2.5 text-sm cursor-pointer select-none outline-none transition-colors",
        "hover:bg-(--tx-bg-active) hover:text-(--tx-text-primary)",
        isSelected && "bg-(--tx-bg-active) text-(--tx-text-primary)",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span className="flex-1 truncate">{children}</span>
      {isSelected && <CheckIcon className="absolute right-2 size-4 text-(--tx-accent-default)" />}
    </div>
  )
}

// ═══ 导出 ═══

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
