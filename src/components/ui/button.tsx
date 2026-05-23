import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-(--tx-accent-default) text-white hover:bg-(--tx-accent-hover)",
        outline:
          "border border-(--tx-border-light) bg-(--tx-bg-surface) text-(--tx-text-primary) hover:bg-(--tx-bg-hover)",
        secondary:
          "border border-transparent bg-(--tx-bg-hover) text-(--tx-text-primary) hover:bg-(--tx-bg-active)",
        ghost:
          "border border-transparent bg-transparent text-(--tx-text-tertiary) hover:bg-(--tx-bg-hover) hover:text-(--tx-text-primary)",
        destructive:
          "border border-transparent bg-(--tx-red) text-white hover:bg-(--tx-red)/80",
        link: "text-(--tx-text-link) underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-4 rounded-(--tx-radius-md) text-xs font-medium",
        sm: "h-7 gap-1 px-3 rounded-(--tx-radius-sm) text-xs",
        lg: "h-9 gap-1.5 px-5 rounded-(--tx-radius-md) text-sm",
        icon: "h-8 w-8 rounded-(--tx-radius-md)",
        "icon-sm": "h-7 w-7 rounded-(--tx-radius-sm)",
        "icon-xs": "h-6 w-6 rounded-(--tx-radius-sm)",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
