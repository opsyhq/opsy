import { Hono } from "hono"
import type { AppEnv } from "../types"
import { requireThinkingBlockSuperAdmin } from "./access"
import { getArtifactDetail, listArtifactVersions, listBlocks, listBlockResources, searchArtifacts } from "./audit"

export const thinkingBlockRoutes = new Hono<AppEnv>()
	.use("*", requireThinkingBlockSuperAdmin())
	.get("/blocks", listBlocks)
	.get("/blocks/:blockName/resources", listBlockResources)
	.get("/resources/:identityRef/artifacts", listArtifactVersions)
	.get("/artifacts/:artifactId", getArtifactDetail)
	.get("/search", searchArtifacts)
