import { useState } from "react"
import { Package } from "lucide-react"

export function ItemRegistryImage({
  src,
  large = false,
}: {
  src: string
  large?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const className = large
    ? "h-40 w-28 shrink-0 object-contain"
    : "h-14 w-10 shrink-0 object-contain"
  return src && !failed ? (
    <img
      src={src}
      alt=""
      width={large ? 112 : 40}
      height={large ? 160 : 56}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className={`${className} flex items-center justify-center text-ink-muted`}
    >
      <Package aria-hidden="true" className="size-6" />
    </span>
  )
}
