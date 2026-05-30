import { createContext, useContext } from "react"

export type CanvasContextValue = {
	projectSlug: string
	changeSetId: string | null
}

const DEFAULT: CanvasContextValue = { projectSlug: "", changeSetId: null }

export const CanvasContext = createContext<CanvasContextValue>(DEFAULT)

export function useCanvasContext(): CanvasContextValue {
	return useContext(CanvasContext)
}
