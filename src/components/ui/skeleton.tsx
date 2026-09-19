import { cn } from "cn"

/* A dithered placeholder that dissolves to the right; no pulse. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-surface dot-screen mask-[linear-gradient(to_right,black,transparent)] text-rule-strong",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
