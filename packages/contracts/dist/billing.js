import { z } from "zod";
import { IsoTimestampSchema } from "./common.js";
export const BillingPlanEnum = z.enum(["free", "team", "enterprise"]);
export const BillingSourceEnum = z.enum(["free", "stripe", "manual"]);
export const BillingUsageSchema = z.object({
    activeUsers: z.number().int().nonnegative(),
    pendingInvites: z.number().int().nonnegative(),
    seatsCounted: z.number().int().nonnegative(),
    workspaces: z.number().int().nonnegative(),
    stacks: z.number().int().nonnegative(),
});
export const BillingLimitsSchema = z.object({
    users: z.number().int().nonnegative().nullable(),
    workspaces: z.number().int().nonnegative().nullable(),
    stacks: z.number().int().nonnegative().nullable(),
});
export const BillingFeaturesSchema = z.object({
    auditLog: z.boolean(),
    sso: z.boolean(),
    domainVerification: z.boolean(),
    apiKeys: z.boolean(),
    dedicatedSupport: z.boolean(),
    sla: z.boolean(),
    emailSupport: z.boolean(),
});
export const BillingFeatureKeyEnum = BillingFeaturesSchema.keyof();
export const BillingBlockedActionsSchema = z.object({
    addUser: z.boolean(),
    createWorkspace: z.boolean(),
    createStack: z.boolean(),
});
export const OrgBillingSummarySchema = z.object({
    orgId: z.string().min(1),
    plan: BillingPlanEnum,
    billingSource: BillingSourceEnum,
    subscriptionStatus: z.string().nullable(),
    currentPeriodEnd: IsoTimestampSchema.nullable(),
    cancelAtPeriodEnd: z.boolean(),
    usage: BillingUsageSchema,
    limits: BillingLimitsSchema,
    features: BillingFeaturesSchema,
    blocked: BillingBlockedActionsSchema,
});
export const CheckoutSessionResponseSchema = z.object({
    url: z.string().url(),
});
export const BillingPortalResponseSchema = z.object({
    url: z.string().url(),
});
//# sourceMappingURL=billing.js.map