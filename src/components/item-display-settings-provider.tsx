import { createContext, useContext, useState } from "react"
import type { ReactNode } from "react"
import { useShowBondedModifiers } from "../lib/item-display-settings"

const BondedBuildContext = createContext({
  automatic: false,
  setAutomatic: (_value: boolean) => {},
})

export function ItemDisplaySettingsProvider({
  children,
}: {
  children: ReactNode
}) {
  const [automatic, setAutomatic] = useState(false)
  return (
    <BondedBuildContext.Provider value={{ automatic, setAutomatic }}>
      {children}
    </BondedBuildContext.Provider>
  )
}

export function useBondedModifiers() {
  const context = useContext(BondedBuildContext)
  const manual = useShowBondedModifiers()
  return { ...context, enabled: context.automatic || manual }
}
