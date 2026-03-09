import { z, type ZodType } from "zod";
import { ApiError, CliError } from "./errors.js";
import {
  DraftCreateResponseSchema,
  DraftDetailSchema,
  DraftListResponseSchema,
  DraftMutationResponseSchema,
  DraftValidateResponseSchema,
  EnvConfigResponseSchema,
  EnvCreateResponseSchema,
  EnvListResponseSchema,
  ErrorResponseSchema,
  StackCreateResponseSchema,
  WorkspaceCreateResponseSchema,
  OrgNotesResponseSchema,
  OrgVariableListResponseSchema,
  OrgVariableSchema,
  RevisionDetailSchema,
  RevisionListResponseSchema,
  RunCancelResponseSchema,
  RunGetResponseSchema,
  RunListResponseSchema,
  RunWaitResponseSchema,
  StackApplyResponseSchema,
  StackDetailSchema,
  StackImportResponseSchema,
  StackListResponseSchema,
  StackStateResponseSchema,
  WhoAmIResponseSchema,
  WorkspaceDetailSchema,
  WorkspaceListResponseSchema,
  type DraftCreateResponse,
  type DraftDetail,
  type DraftListResponse,
  type DraftMutationResponse,
  type DraftValidateResponse,
  type EnvConfigResponse,
  type EnvCreateResponse,
  type EnvListItem,
  type StackCreateResponse,
  type WorkspaceCreateResponse,
  type OrgNotesResponse,
  type OrgVariableItem,
  type RevisionDetail,
  type RevisionListResponse,
  type RunCancelResponse,
  type RunGetResponse,
  type RunListResponse,
  type RunWaitResponse,
  type StackApplyResponse,
  type StackDetail,
  type StackImportResponse,
  type StackListItem,
  type StackStateEnv,
  type WhoAmIResponse,
  type WorkspaceDetail,
  type WorkspaceListItem,
} from "./schemas.js";

export type ApiClientOptions = {
  apiUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
  userAgent?: string;
};

export type ListRunsOptions = {
  workspace: string;
  stack?: string;
  status?: string;
  excludeStatus?: string;
  cursor?: string;
  limit?: number;
};

export type ListRevisionsOptions = {
  cursor?: string;
  limit?: number;
};

export class ApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly apiUrl: string;
  private readonly token: string;
  private readonly userAgent: string;

  constructor(options: ApiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.apiUrl = options.apiUrl;
    this.token = options.token;
    this.userAgent = options.userAgent ?? "opsy-cli/0.0.0";
  }

  getWhoAmI(): Promise<WhoAmIResponse> {
    return this.request("GET", "/auth/whoami", WhoAmIResponseSchema);
  }

  listWorkspaces(): Promise<WorkspaceListItem[]> {
    return this.request("GET", "/workspaces", WorkspaceListResponseSchema);
  }

  getWorkspace(workspace: string): Promise<WorkspaceDetail> {
    return this.request("GET", `/workspaces/${encodeURIComponent(workspace)}`, WorkspaceDetailSchema);
  }

  createWorkspace(body: { slug: string; name: string; envs?: Array<{ slug: string }> }): Promise<WorkspaceCreateResponse> {
    return this.request("POST", "/workspaces", WorkspaceCreateResponseSchema, body);
  }

  updateWorkspace(workspace: string, body: { name?: string; notes?: string | null }): Promise<WorkspaceDetail> {
    return this.request("PATCH", `/workspaces/${encodeURIComponent(workspace)}`, WorkspaceDetailSchema, body);
  }

  deleteWorkspace(workspace: string): Promise<void> {
    return this.requestNoContent("DELETE", `/workspaces/${encodeURIComponent(workspace)}`);
  }

  listStacks(workspace: string): Promise<StackListItem[]> {
    return this.request("GET", `/workspaces/${encodeURIComponent(workspace)}/stacks`, StackListResponseSchema);
  }

  getStack(workspace: string, stack: string): Promise<StackDetail> {
    return this.request(
      "GET",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}`,
      StackDetailSchema,
    );
  }

  createStack(workspace: string, body: { slug: string; yaml?: string }): Promise<StackCreateResponse> {
    return this.request(
      "POST",
      `/workspaces/${encodeURIComponent(workspace)}/stacks`,
      StackCreateResponseSchema,
      body,
    );
  }

  setStackNotes(workspace: string, stack: string, notes: string | null): Promise<StackCreateResponse> {
    return this.request(
      "PATCH",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/notes`,
      StackCreateResponseSchema,
      { notes },
    );
  }

  deleteStack(workspace: string, stack: string): Promise<void> {
    return this.requestNoContent(
      "DELETE",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}`,
    );
  }

  getStackState(workspace: string, stack: string): Promise<StackStateEnv[]> {
    return this.request(
      "GET",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/state`,
      StackStateResponseSchema,
    );
  }

  listEnvs(workspace: string): Promise<EnvListItem[]> {
    return this.request("GET", `/workspaces/${encodeURIComponent(workspace)}/envs`, EnvListResponseSchema);
  }

  createEnv(workspace: string, slug: string): Promise<EnvCreateResponse> {
    return this.request(
      "POST",
      `/workspaces/${encodeURIComponent(workspace)}/envs`,
      EnvCreateResponseSchema,
      { slug },
    );
  }

  deleteEnv(workspace: string, env: string): Promise<void> {
    return this.requestNoContent(
      "DELETE",
      `/workspaces/${encodeURIComponent(workspace)}/envs/${encodeURIComponent(env)}`,
    );
  }

  getEnvConfig(workspace: string, env: string): Promise<EnvConfigResponse> {
    return this.request(
      "GET",
      `/workspaces/${encodeURIComponent(workspace)}/envs/${encodeURIComponent(env)}/config`,
      EnvConfigResponseSchema,
    );
  }

  setEnvConfig(
    workspace: string,
    env: string,
    body: {
      providerProfileBindings?: Array<{ providerPkg: string; profileName: string; config?: Record<string, string> }>;
      variables?: Array<{ key: string; value: string; sensitive?: boolean }>;
    },
  ): Promise<void> {
    return this.requestNoContent(
      "PUT",
      `/workspaces/${encodeURIComponent(workspace)}/envs/${encodeURIComponent(env)}/config`,
      body,
    );
  }

  getRun(runId: string): Promise<RunGetResponse> {
    return this.request(
      "GET",
      `/runs/${encodeURIComponent(runId)}`,
      RunGetResponseSchema,
    );
  }

  listRuns(options: ListRunsOptions): Promise<RunListResponse> {
    const query = new URLSearchParams();
    if (options.stack) {
      query.set("stack", options.stack);
    }
    if (options.status) {
      query.set("status", options.status);
    }
    if (options.excludeStatus) {
      query.set("excludeStatus", options.excludeStatus);
    }
    if (options.cursor) {
      query.set("cursor", options.cursor);
    }
    if (options.limit !== undefined) {
      query.set("limit", String(options.limit));
    }

    return this.request(
      "GET",
      `/workspaces/${encodeURIComponent(options.workspace)}/runs${query.size > 0 ? `?${query.toString()}` : ""}`,
      RunListResponseSchema,
    );
  }

  waitForRun(runId: string, timeoutSeconds?: number): Promise<RunWaitResponse> {
    const query = new URLSearchParams();
    if (timeoutSeconds !== undefined) {
      query.set("timeoutSeconds", String(timeoutSeconds));
    }

    return this.request(
      "GET",
      `/runs/${encodeURIComponent(runId)}/wait${query.size > 0 ? `?${query.toString()}` : ""}`,
      RunWaitResponseSchema,
    );
  }

  cancelRun(runId: string, force?: boolean): Promise<RunCancelResponse> {
    return this.request(
      "POST",
      `/runs/${encodeURIComponent(runId)}/cancel`,
      RunCancelResponseSchema,
      force === undefined ? undefined : { force },
    );
  }

  listDrafts(workspace: string, stack: string): Promise<DraftListResponse> {
    return this.request(
      "GET",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/drafts`,
      DraftListResponseSchema,
    );
  }

  getDraft(draftShortId: string): Promise<DraftDetail> {
    return this.request(
      "GET",
      `/drafts/${encodeURIComponent(draftShortId)}`,
      DraftDetailSchema,
    );
  }

  getScopedDraft(workspace: string, stack: string, draftShortId: string): Promise<DraftDetail> {
    return this.request(
      "GET",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/drafts/${encodeURIComponent(draftShortId)}`,
      DraftDetailSchema,
    );
  }

  createDraft(workspace: string, stack: string, name?: string): Promise<DraftCreateResponse> {
    return this.request(
      "POST",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/drafts`,
      DraftCreateResponseSchema,
      name === undefined ? undefined : { name },
    );
  }

  writeDraft(draftShortId: string, yaml: string): Promise<DraftMutationResponse> {
    return this.request(
      "PUT",
      `/drafts/${encodeURIComponent(draftShortId)}/spec`,
      DraftMutationResponseSchema,
      { yaml },
    );
  }

  writeScopedDraft(workspace: string, stack: string, draftShortId: string, yaml: string): Promise<DraftMutationResponse> {
    return this.request(
      "PUT",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/drafts/${encodeURIComponent(draftShortId)}/spec`,
      DraftMutationResponseSchema,
      { yaml },
    );
  }

  editDraft(draftShortId: string, oldString: string, newString: string): Promise<DraftMutationResponse> {
    return this.request(
      "PATCH",
      `/drafts/${encodeURIComponent(draftShortId)}`,
      DraftMutationResponseSchema,
      { oldString, newString },
    );
  }

  editScopedDraft(
    workspace: string,
    stack: string,
    draftShortId: string,
    oldString: string,
    newString: string,
  ): Promise<DraftMutationResponse> {
    return this.request(
      "PATCH",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/drafts/${encodeURIComponent(draftShortId)}`,
      DraftMutationResponseSchema,
      { oldString, newString },
    );
  }

  validateDraft(draftShortId: string): Promise<DraftValidateResponse> {
    return this.request(
      "POST",
      `/drafts/${encodeURIComponent(draftShortId)}/validate`,
      DraftValidateResponseSchema,
    );
  }

  validateScopedDraft(workspace: string, stack: string, draftShortId: string): Promise<DraftValidateResponse> {
    return this.request(
      "POST",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/drafts/${encodeURIComponent(draftShortId)}/validate`,
      DraftValidateResponseSchema,
    );
  }

  deleteDraft(draftShortId: string): Promise<void> {
    return this.requestNoContent(
      "DELETE",
      `/drafts/${encodeURIComponent(draftShortId)}`,
    );
  }

  deleteScopedDraft(workspace: string, stack: string, draftShortId: string): Promise<void> {
    return this.requestNoContent(
      "DELETE",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/drafts/${encodeURIComponent(draftShortId)}`,
    );
  }

  listRevisions(workspace: string, stack: string, options: ListRevisionsOptions = {}): Promise<RevisionListResponse> {
    const query = new URLSearchParams();
    if (options.cursor) {
      query.set("cursor", options.cursor);
    }
    if (options.limit !== undefined) {
      query.set("limit", String(options.limit));
    }

    return this.request(
      "GET",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/revisions${query.size > 0 ? `?${query.toString()}` : ""}`,
      RevisionListResponseSchema,
    );
  }

  getHeadRevision(workspace: string, stack: string): Promise<RevisionDetail> {
    return this.request(
      "GET",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/revisions/head`,
      RevisionDetailSchema,
    );
  }

  getRevision(workspace: string, stack: string, revisionNumber: number): Promise<RevisionDetail> {
    return this.request(
      "GET",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/revisions/${revisionNumber}`,
      RevisionDetailSchema,
    );
  }

  deleteRevision(workspace: string, stack: string, revisionId: string): Promise<void> {
    return this.requestNoContent(
      "DELETE",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/revisions/${encodeURIComponent(revisionId)}`,
    );
  }

  applyRun(
    workspace: string,
    stack: string,
    body: {
      envSlug: string;
      draftShortId?: string;
      revisionNumber?: number;
      previewOnly?: boolean;
      reason?: string;
    },
  ): Promise<StackApplyResponse> {
    return this.request(
      "POST",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/apply`,
      StackApplyResponseSchema,
      body,
    );
  }

  importRun(
    workspace: string,
    stack: string,
    body: {
      envSlug: string;
      targets: Array<{ type: string; name: string; id: string }>;
      reason?: string;
    },
  ): Promise<StackImportResponse> {
    return this.request(
      "POST",
      `/workspaces/${encodeURIComponent(workspace)}/stacks/${encodeURIComponent(stack)}/import`,
      StackImportResponseSchema,
      body,
    );
  }

  listOrgVariables(): Promise<OrgVariableItem[]> {
    return this.request("GET", "/org/variables", OrgVariableListResponseSchema);
  }

  setOrgVariable(key: string, value: string, sensitive?: boolean): Promise<OrgVariableItem> {
    return this.request("POST", "/org/variables", OrgVariableSchema, { key, value, sensitive });
  }

  deleteOrgVariable(key: string): Promise<void> {
    return this.requestNoContent("DELETE", `/org/variables/${encodeURIComponent(key)}`);
  }

  getOrgNotes(): Promise<OrgNotesResponse> {
    return this.request("GET", "/org/notes", OrgNotesResponseSchema);
  }

  setOrgNotes(content: string): Promise<OrgNotesResponse> {
    return this.request("PUT", "/org/notes", OrgNotesResponseSchema, { content });
  }

  deleteOrgNotes(): Promise<void> {
    return this.requestNoContent("DELETE", "/org/notes");
  }

  private async requestNoContent(method: string, path: string, body?: unknown): Promise<void> {
    await this.request(method, path, z.null(), body);
  }

  private async request<T>(method: string, path: string, schema: ZodType<T>, body?: unknown): Promise<T> {
    const url = new URL(path, `${this.apiUrl}/`).toString();
    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          authorization: `Bearer ${this.token}`,
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          "user-agent": this.userAgent,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      throw new CliError("Request failed before reaching the API.", {
        code: "NETWORK_ERROR",
        details: error instanceof Error ? error.message : error,
      });
    }

    const text = await response.text();
    const json = text.length > 0 ? safeJsonParse(text) : null;

    if (!response.ok) {
      const parsedError = ErrorResponseSchema.safeParse(json);
      if (parsedError.success) {
        throw new ApiError(response.status, parsedError.data);
      }
      throw new ApiError(response.status, {
        message: response.statusText || "The API request failed.",
      });
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new CliError("The API returned an unexpected response.", {
        code: "INVALID_RESPONSE",
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
