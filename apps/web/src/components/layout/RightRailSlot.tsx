import { createContext, useContext } from "react"

export const RightRailSlotContext = createContext<HTMLDivElement | null>(null)

export function useRightRailSlot() {
	return useContext(RightRailSlotContext)
}
