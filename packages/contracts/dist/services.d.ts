import { z } from "zod";
export declare const ServiceActorSchema: z.ZodObject<{
    userId: z.ZodString;
    orgId: z.ZodString;
    actorType: z.ZodEnum<{
        user: "user";
        agent: "agent";
    }>;
}, z.core.$strip>;
export declare const WorkspaceListOptionsSchema: z.ZodObject<{
    includeCounts: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const WorkspaceCreateInputSchema: z.ZodObject<{
    slug: z.ZodString;
    name: z.ZodString;
    envs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        slug: z.ZodString;
        config: z.ZodOptional<z.ZodObject<{
            providerProfileBindings: z.ZodOptional<z.ZodArray<z.ZodObject<{
                providerPkg: z.ZodString;
                profileName: z.ZodString;
                config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            }, z.core.$strip>>>;
            variables: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                value: z.ZodString;
                sensitive: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const WorkspaceSetEnvInputSchema: z.ZodObject<{
    workspaceSlug: z.ZodString;
    envSlug: z.ZodString;
    config: z.ZodOptional<z.ZodObject<{
        providerProfileBindings: z.ZodOptional<z.ZodArray<z.ZodObject<{
            providerPkg: z.ZodString;
            profileName: z.ZodString;
            config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strip>>>;
        variables: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodString;
            sensitive: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const WorkspaceSetNotesInputSchema: z.ZodObject<{
    workspaceSlug: z.ZodString;
    notes: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type ServiceActor = z.infer<typeof ServiceActorSchema>;
export type WorkspaceListOptions = z.infer<typeof WorkspaceListOptionsSchema>;
export type WorkspaceCreateInput = z.infer<typeof WorkspaceCreateInputSchema>;
export type WorkspaceSetEnvInput = z.infer<typeof WorkspaceSetEnvInputSchema>;
export type WorkspaceSetNotesInput = z.infer<typeof WorkspaceSetNotesInputSchema>;
//# sourceMappingURL=services.d.ts.map