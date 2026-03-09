import { z } from "zod";
export const RunKindEnum = z.enum(["preview", "apply", "import"]);
export const RunStatusEnum = z.enum([
    "queued",
    "awaiting_approval",
    "running",
    "applied",
    "failed",
    "rejected",
    "canceled",
]);
/** Run statuses that indicate the run is still in progress. */
export const ACTIVE_RUN_STATUSES = ["queued", "running", "awaiting_approval"];
export const ApprovalStatusEnum = z.enum(["pending", "approved", "rejected"]);
export const JobTypeEnum = z.enum(["preview", "apply", "import"]);
export const JobStatusEnum = z.enum(["queued", "leased", "running", "succeeded", "failed"]);
export const RUN_STATUS_TRANSITIONS = {
    queued: ["awaiting_approval", "running", "failed", "canceled"],
    awaiting_approval: ["running", "rejected", "canceled"],
    running: ["applied", "failed", "canceled"],
    applied: [],
    failed: [],
    rejected: [],
    canceled: [],
};
export const APPROVAL_STATUS_TRANSITIONS = {
    pending: ["approved", "rejected"],
    approved: [],
    rejected: [],
};
export const JOB_STATUS_TRANSITIONS = {
    queued: ["leased", "failed"],
    leased: ["running", "failed"],
    running: ["succeeded", "failed"],
    succeeded: [],
    failed: ["queued"],
};
function createTransitionValidator(allowed, subject) {
    return {
        canTransition(from, to) {
            return allowed[from].includes(to);
        },
        assertTransition(from, to) {
            if (!allowed[from].includes(to)) {
                throw new Error(`Invalid ${subject} transition: ${from} -> ${to}`);
            }
        },
    };
}
export const runTransitions = createTransitionValidator(RUN_STATUS_TRANSITIONS, "run");
export const approvalTransitions = createTransitionValidator(APPROVAL_STATUS_TRANSITIONS, "approval");
export const jobTransitions = createTransitionValidator(JOB_STATUS_TRANSITIONS, "job");
//# sourceMappingURL=status.js.map