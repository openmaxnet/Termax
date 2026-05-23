import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "h-9 w-full rounded-(--tx-radius-md) border border-(--tx-border-light) bg-transparent px-3 py-1 text-sm text-(--tx-text-primary) shadow-sm transition-colors placeholder:text-(--tx-text-tertiary) focus-visible:outline-none focus-visible:border-(--tx-border-focus) focus-visible:ring-2 focus-visible:ring-(--tx-border-focus)/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
