import { z } from "zod";
export declare const BillingPlanEnum: z.ZodEnum<{
    free: "free";
    team: "team";
    enterprise: "enterprise";
}>;
export type BillingPlan = z.infer<typeof BillingPlanEnum>;
export declare const BillingSourceEnum: z.ZodEnum<{
    free: "free";
    stripe: "stripe";
    manual: "manual";
}>;
export type BillingSource = z.infer<typeof BillingSourceEnum>;
export declare const BillingUsageSchema: z.ZodObject<{
    activeUsers: z.ZodNumber;
    pendingInvites: z.ZodNumber;
    seatsCounted: z.ZodNumber;
    workspaces: z.ZodNumber;
    stacks: z.ZodNumber;
}, z.core.$strip>;
export type BillingUsage = z.infer<typeof BillingUsageSchema>;
export declare const BillingLimitsSchema: z.ZodObject<{
    users: z.ZodNullable<z.ZodNumber>;
    workspaces: z.ZodNullable<z.ZodNumber>;
    stacks: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
export type BillingLimits = z.infer<typeof BillingLimitsSchema>;
export declare const BillingFeaturesSchema: z.ZodObject<{
    auditLog: z.ZodBoolean;
    sso: z.ZodBoolean;
    domainVerification: z.ZodBoolean;
    apiKeys: z.ZodBoolean;
    dedicatedSupport: z.ZodBoolean;
    sla: z.ZodBoolean;
    emailSupport: z.ZodBoolean;
}, z.core.$strip>;
export type BillingFeatures = z.infer<typeof BillingFeaturesSchema>;
export declare const BillingFeatureKeyEnum: z.ZodEnum<{
    auditLog: "auditLog";
    sso: "sso";
    domainVerification: "domainVerification";
    apiKeys: "apiKeys";
    dedicatedSupport: "dedicatedSupport";
    sla: "sla";
    emailSupport: "emailSupport";
}>;
export type BillingFeatureKey = z.infer<typeof BillingFeatureKeyEnum>;
export declare const BillingBlockedActionsSchema: z.ZodObject<{
    addUser: z.ZodBoolean;
    createWorkspace: z.ZodBoolean;
    createStack: z.ZodBoolean;
}, z.core.$strip>;
export type BillingBlockedActions = z.infer<typeof BillingBlockedActionsSchema>;
export declare const OrgBillingSummarySchema: z.ZodObject<{
    orgId: z.ZodString;
    plan: z.ZodEnum<{
        free: "free";
        team: "team";
        enterprise: "enterprise";
    }>;
    billingSource: z.ZodEnum<{
        free: "free";
        stripe: "stripe";
        manual: "manual";
    }>;
    subscriptionStatus: z.ZodNullable<z.ZodString>;
    currentPeriodEnd: z.ZodNullable<z.ZodString>;
    cancelAtPeriodEnd: z.ZodBoolean;
    usage: z.ZodObject<{
        activeUsers: z.ZodNumber;
        pendingInvites: z.ZodNumber;
        seatsCounted: z.ZodNumber;
        workspaces: z.ZodNumber;
        stacks: z.ZodNumber;
    }, z.core.$strip>;
    limits: z.ZodObject<{
        users: z.ZodNullable<z.ZodNumber>;
        workspaces: z.ZodNullable<z.ZodNumber>;
        stacks: z.ZodNullable<z.ZodNumber>;
    }, z.core.$strip>;
    features: z.ZodObject<{
        auditLog: z.ZodBoolean;
        sso: z.ZodBoolean;
        domainVerification: z.ZodBoolean;
        apiKeys: z.ZodBoolean;
        dedicatedSupport: z.ZodBoolean;
        sla: z.ZodBoolean;
        emailSupport: z.ZodBoolean;
    }, z.core.$strip>;
    blocked: z.ZodObject<{
        addUser: z.ZodBoolean;
        createWorkspace: z.ZodBoolean;
        createStack: z.ZodBoolean;
    }, z.core.$strip>;
}, z.core.$strip>;
export type OrgBillingSummary = z.infer<typeof OrgBillingSummarySchema>;
export declare const CheckoutSessionResponseSchema: z.ZodObject<{
    url: z.ZodString;
}, z.core.$strip>;
export type CheckoutSessionResponse = z.infer<typeof CheckoutSessionResponseSchema>;
export declare const BillingPortalResponseSchema: z.ZodObject<{
    url: z.ZodString;
}, z.core.$strip>;
export type BillingPortalResponse = z.infer<typeof BillingPortalResponseSchema>;
//# sourceMappingURL=billing.d.ts.map