import { cn } from "cn"
import { Button } from "../ui/button"

/** The build page's bronze call to action: a bronze fill in a hairline
 * frame that deepens to brand-ink on hover. */
function BuildPrimaryButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "border-rule-strong bg-brand px-3.5 text-paper hover:bg-brand-ink",
        className
      )}
      {...props}
    />
  )
}

export { BuildPrimaryButton }
