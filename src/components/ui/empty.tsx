import * as React from "react"
import { cn } from "@/lib/utils"

interface EmptyProps extends React.ComponentProps<"div"> {}

function Empty({ className, ...props }: EmptyProps) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
      {...props}
    />
  )
}

interface EmptyHeaderProps extends React.ComponentProps<"div"> {}

function EmptyHeader({ className, ...props }: EmptyHeaderProps) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex flex-col items-center gap-2 px-4", className)}
      {...props}
    />
  )
}

interface EmptyMediaProps extends React.ComponentProps<"div"> {
  variant?: "default" | "icon"
}

function EmptyMedia({
  variant = "default",
  className,
  children,
  ...props
}: EmptyMediaProps) {
  return (
    <div
      data-slot="empty-media"
      data-variant={variant}
      className={cn(
        "flex items-center justify-center",
        variant === "icon" && "text-muted-foreground/40",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface EmptyTitleProps extends React.ComponentProps<"h3"> {}

function EmptyTitle({ className, ...props }: EmptyTitleProps) {
  return (
    <h3
      data-slot="empty-title"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  )
}

interface EmptyDescriptionProps extends React.ComponentProps<"p"> {}

function EmptyDescription({ className, ...props }: EmptyDescriptionProps) {
  return (
    <p
      data-slot="empty-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

interface EmptyContentProps extends React.ComponentProps<"div"> {}

function EmptyContent({ className, ...props }: EmptyContentProps) {
  return (
    <div
      data-slot="empty-content"
      className={cn("mt-4 flex items-center justify-center gap-2", className)}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
}
