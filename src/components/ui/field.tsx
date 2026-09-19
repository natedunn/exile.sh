import * as React from "react"
import { cn } from "cn"

import { Label } from "@/components/ui/label"

/* A label stacked over its control. */
function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field"
      className={cn("group/field grid gap-2", className)}
      {...props}
    />
  )
}

function FieldLabel(props: React.ComponentProps<typeof Label>) {
  return <Label data-slot="field-label" {...props} />
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-xs leading-relaxed text-ink-muted", className)}
      {...props}
    />
  )
}

function FieldError({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-error"
      role="alert"
      className={cn("text-xs leading-relaxed text-negative", className)}
      {...props}
    />
  )
}

export { Field, FieldLabel, FieldDescription, FieldError }
