import { useState } from "react"

/** Reference page artwork: the item or gem icon in an inventory slot,
 * set left of the heading copy. Hidden when the image fails to load. */
export function ReferenceArt({
  src,
  unique = false,
}: {
  src: string
  unique?: boolean
}) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none flex size-36 shrink-0 max-sm:size-24"
    >
      <div
        className="item-slot p-2.5 max-sm:p-2 [&>img]:size-full"
        data-rarity={unique ? "UNIQUE" : undefined}
      >
        <img
          src={src}
          alt=""
          decoding="async"
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  )
}
