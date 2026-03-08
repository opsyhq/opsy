import { z } from "zod";
import { SetEnvConfigSchema } from "./rest.js";
import { SlugSchema } from "./common.js";

export const ServiceActorSchema = z.object({
  userId: z.string().min(1),
  orgId: z.string().min(1),
  actorType: z.enum(["user", "agent"]),
});

export const WorkspaceListOptionsSchema = z.object({
  includeCounts: z.boolean().optional(),
});

export const WorkspaceCreateInputSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1).max(128),
  envs: z
    .array(
      z.object({
        slug: SlugSchema,
        config: SetEnvConfigSchema.optional(),
      }),
    )
    .optional(),
});

export const WorkspaceSetEnvInputSchema = z.object({
  workspaceSlug: SlugSchema,
  envSlug: SlugSchema,
  config: SetEnvConfigSchema.optional(),
});

export const WorkspaceSetNotesInputSchema = z.object({
  workspaceSlug: SlugSchema,
  notes: z.string().nullable(),
});

export type ServiceActor = z.infer<typeof ServiceActorSchema>;
export type WorkspaceListOptions = z.infer<typeof WorkspaceListOptionsSchema>;
export type WorkspaceCreateInput = z.infer<typeof WorkspaceCreateInputSchema>;
export type WorkspaceSetEnvInput = z.infer<typeof WorkspaceSetEnvInputSchema>;
export type WorkspaceSetNotesInput = z.infer<typeof WorkspaceSetNotesInputSchema>;
