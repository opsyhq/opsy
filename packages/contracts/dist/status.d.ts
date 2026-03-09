import { z } from "zod";
export declare const RunKindEnum: z.ZodEnum<{
    preview: "preview";
    apply: "apply";
    import: "import";
}>;
export type RunKind = z.infer<typeof RunKindEnum>;
export declare const RunStatusEnum: z.ZodEnum<{
    queued: "queued";
    awaiting_approval: "awaiting_approval";
    running: "running";
    applied: "applied";
    failed: "failed";
    rejected: "rejected";
    canceled: "canceled";
}>;
export type RunStatus = z.infer<typeof RunStatusEnum>;
/** Run statuses that indicate the run is still in progress. */
export declare const ACTIVE_RUN_STATUSES: readonly RunStatus[];
export declare const ApprovalStatusEnum: z.ZodEnum<{
    rejected: "rejected";
    pending: "pending";
    approved: "approved";
}>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;
export declare const JobTypeEnum: z.ZodEnum<{
    preview: "preview";
    apply: "apply";
    import: "import";
}>;
export type JobType = z.infer<typeof JobTypeEnum>;
export declare const JobStatusEnum: z.ZodEnum<{
    queued: "queued";
    running: "running";
    failed: "failed";
    leased: "leased";
    succeeded: "succeeded";
}>;
export type JobStatus = z.infer<typeof JobStatusEnum>;
export declare const RUN_STATUS_TRANSITIONS: Record<RunStatus, readonly RunStatus[]>;
export declare const APPROVAL_STATUS_TRANSITIONS: Record<ApprovalStatus, readonly ApprovalStatus[]>;
export declare const JOB_STATUS_TRANSITIONS: Record<JobStatus, readonly JobStatus[]>;
export declare const runTransitions: {
    canTransition(from: "queued" | "awaiting_approval" | "running" | "applied" | "failed" | "rejected" | "canceled", to: "queued" | "awaiting_approval" | "running" | "applied" | "failed" | "rejected" | "canceled"): boolean;
    assertTransition(from: "queued" | "awaiting_approval" | "running" | "applied" | "failed" | "rejected" | "canceled", to: "queued" | "awaiting_approval" | "running" | "applied" | "failed" | "rejected" | "canceled"): void;
};
export declare const approvalTransitions: {
    canTransition(from: "rejected" | "pending" | "approved", to: "rejected" | "pending" | "approved"): boolean;
    assertTransition(from: "rejected" | "pending" | "approved", to: "rejected" | "pending" | "approved"): void;
};
export declare const jobTransitions: {
    canTransition(from: "queued" | "running" | "failed" | "leased" | "succeeded", to: "queued" | "running" | "failed" | "leased" | "succeeded"): boolean;
    assertTransition(from: "queued" | "running" | "failed" | "leased" | "succeeded", to: "queued" | "running" | "failed" | "leased" | "succeeded"): void;
};
//# sourceMappingURL=status.d.ts.map