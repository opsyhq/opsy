import { z } from "zod";

export const RunKindEnum = z.enum(["preview", "apply", "import"]);
export type RunKind = z.infer<typeof RunKindEnum>;

export const RunStatusEnum = z.enum([
  "queued",
  "awaiting_approval",
  "running",
  "applied",
  "failed",
  "rejected",
  "canceled",
]);
export type RunStatus = z.infer<typeof RunStatusEnum>;

/** Run statuses that indicate the run is still in progress. */
export const ACTIVE_RUN_STATUSES: readonly RunStatus[] = ["queued", "running", "awaiting_approval"];

export const ApprovalStatusEnum = z.enum(["pending", "approved", "rejected"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;

export const JobTypeEnum = z.enum(["preview", "apply", "import"]);
export type JobType = z.infer<typeof JobTypeEnum>;

export const JobStatusEnum = z.enum(["queued", "leased", "running", "succeeded", "failed"]);
export type JobStatus = z.infer<typeof JobStatusEnum>;

export const RUN_STATUS_TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  queued: ["awaiting_approval", "running", "failed", "canceled"],
  awaiting_approval: ["running", "rejected", "canceled"],
  running: ["applied", "failed", "canceled"],
  applied: [],
  failed: [],
  rejected: [],
  canceled: [],
};

export const APPROVAL_STATUS_TRANSITIONS: Record<ApprovalStatus, readonly ApprovalStatus[]> = {
  pending: ["approved", "rejected"],
  approved: [],
  rejected: [],
};

export const JOB_STATUS_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  queued: ["leased", "failed"],
  leased: ["running", "failed"],
  running: ["succeeded", "failed"],
  succeeded: [],
  failed: ["queued"],
};

function createTransitionValidator<TState extends string>(
  allowed: Record<TState, readonly TState[]>,
  subject: string,
) {
  return {
    canTransition(from: TState, to: TState): boolean {
      return allowed[from].includes(to);
    },
    assertTransition(from: TState, to: TState): void {
      if (!allowed[from].includes(to)) {
        throw new Error(`Invalid ${subject} transition: ${from} -> ${to}`);
      }
    },
  };
}

export const runTransitions = createTransitionValidator(RUN_STATUS_TRANSITIONS, "run");
export const approvalTransitions = createTransitionValidator(APPROVAL_STATUS_TRANSITIONS, "approval");
export const jobTransitions = createTransitionValidator(JOB_STATUS_TRANSITIONS, "job");
