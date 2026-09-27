import * as React from "react"
import { cn } from "cn"

/* The gem page's sections: a rule between each and one title voice. The
 * title takes the shell gutter; content sets its own so
 * tables and lists can run edge to edge. */
function GemSection({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="gem-section"
      className={cn(
        "min-w-0 border-b border-rule-strong py-8 last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function GemSectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="gem-section-title"
      className={cn(
        "px-[var(--shell-gutter)] font-mono text-xs leading-tight font-medium tracking-label text-brand uppercase",
        className
      )}
      {...props}
    />
  )
}

export { GemSection, GemSectionTitle }
