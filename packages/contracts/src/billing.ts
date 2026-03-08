import { z } from "zod";
import { IsoTimestampSchema } from "./common.js";

export const BillingPlanEnum = z.enum(["free", "team", "enterprise"]);
export type BillingPlan = z.infer<typeof BillingPlanEnum>;

export const BillingSourceEnum = z.enum(["free", "stripe", "manual"]);
export type BillingSource = z.infer<typeof BillingSourceEnum>;

export const BillingUsageSchema = z.object({
  activeUsers: z.number().int().nonnegative(),
  pendingInvites: z.number().int().nonnegative(),
  seatsCounted: z.number().int().nonnegative(),
  workspaces: z.number().int().nonnegative(),
  stacks: z.number().int().nonnegative(),
});
export type BillingUsage = z.infer<typeof BillingUsageSchema>;

export const BillingLimitsSchema = z.object({
  users: z.number().int().nonnegative().nullable(),
  workspaces: z.number().int().nonnegative().nullable(),
  stacks: z.number().int().nonnegative().nullable(),
});
export type BillingLimits = z.infer<typeof BillingLimitsSchema>;

export const BillingFeaturesSchema = z.object({
  auditLog: z.boolean(),
  sso: z.boolean(),
  domainVerification: z.boolean(),
  apiKeys: z.boolean(),
  dedicatedSupport: z.boolean(),
  sla: z.boolean(),
  emailSupport: z.boolean(),
});
export type BillingFeatures = z.infer<typeof BillingFeaturesSchema>;

export const BillingFeatureKeyEnum = BillingFeaturesSchema.keyof();
export type BillingFeatureKey = z.infer<typeof BillingFeatureKeyEnum>;

export const BillingBlockedActionsSchema = z.object({
  addUser: z.boolean(),
  createWorkspace: z.boolean(),
  createStack: z.boolean(),
});
export type BillingBlockedActions = z.infer<typeof BillingBlockedActionsSchema>;

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
export type OrgBillingSummary = z.infer<typeof OrgBillingSummarySchema>;

export const CheckoutSessionResponseSchema = z.object({
  url: z.string().url(),
});
export type CheckoutSessionResponse = z.infer<typeof CheckoutSessionResponseSchema>;

export const BillingPortalResponseSchema = z.object({
  url: z.string().url(),
});
export type BillingPortalResponse = z.infer<typeof BillingPortalResponseSchema>;
