import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { navigationItem } from "./navigation-styles"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,opacity,transform] duration-120 ease-out outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-negative [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand text-paper hover:bg-brand/80",
        outline:
          "border-rule-strong bg-surface text-ink hover:border-brand-deep aria-expanded:border-brand-deep",
        secondary:
          "bg-hover text-ink hover:bg-rule aria-expanded:bg-hover aria-expanded:text-ink",
        ghost:
          "text-ink-muted hover:bg-hover hover:text-ink aria-expanded:bg-hover aria-expanded:text-ink",
        destructive:
          "bg-negative/10 text-negative hover:bg-negative/20 focus-visible:outline-negative",
        link: "text-brand underline-offset-4 hover:underline",
        /* Mono caps control on a bordered surface: nav pills, pagination,
           panel triggers. */
        pill: "border-rule-strong bg-surface mono-label text-ink-muted hover:border-brand-deep hover:text-ink aria-expanded:text-ink data-active:border-brand-deep data-active:bg-notice data-active:text-brand",
        /* One cell of a SegmentedControl; the container draws the frame. */
        segment:
          "rounded-none border-0 mono-label text-label text-ink-muted hover:bg-hover hover:text-ink focus-visible:z-1 focus-visible:-outline-offset-3 aria-[current=page]:bg-brand aria-[current=page]:text-paper data-active:bg-brand data-active:text-paper [&_svg]:size-3.5",
        /* Second-level site navigation: quiet text with a masthead-style
           bronze rule for the active destination. */
        subnav: cn(
          "rounded-none border-0 bg-transparent px-0 mono-label text-label hover:bg-transparent focus-visible:z-1 focus-visible:-outline-offset-3",
          navigationItem
        ),
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-2 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        nav: "h-10 gap-2 px-4",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-9",
        /* Text-only: inherits line box, no padding. */
        bare: "h-auto gap-1 p-0",
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
  active,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Selected state for pill and segment variants. */
    active?: boolean
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-active={active ? "" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
