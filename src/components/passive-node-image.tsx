import type { ComponentProps } from "react"

const fallback = "/pob-trees/generic-node.svg"

export function PassiveNodeImage({
  src,
  alt = "",
  ...props
}: Omit<ComponentProps<"img">, "src" | "onError"> & {
  src?: string | null
}) {
  return (
    <img
      {...props}
      src={src || fallback}
      alt={alt}
      onError={(event) => {
        const image = event.currentTarget
        if (image.getAttribute("src") !== fallback) image.src = fallback
      }}
    />
  )
}
