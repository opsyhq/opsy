import { describe, expect, it, mock } from "bun:test";
import { ApiError } from "./errors.js";
import { createApiClient } from "./client.js";

describe("api client", () => {
  it("sends bearer auth and parses successful responses", async () => {
    const fetchImpl = mock(async (input: string | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://localhost:4000/auth/whoami");
      expect(init?.headers).toEqual({
        authorization: "Bearer pat_123",
        accept: "application/json",
        "user-agent": "opsy-cli/0.0.0",
      });
      return new Response(JSON.stringify({
        user: {
          id: "user_123",
          email: "user@example.com",
          firstName: "Test",
          lastName: "User",
          profilePictureUrl: null,
          agentName: "Test User",
          agentAvatarStyle: "shape",
          agentAvatarSeed: "seed",
        },
        actor: {
          userId: "user_123",
          orgId: "org_123",
          actorType: "user",
          authType: "pat",
          credentialId: "pat_123",
          credentialLabel: "CLI",
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const client = createApiClient({
      apiUrl: "http://localhost:4000",
      token: "pat_123",
      fetchImpl,
    });

    const result = await client.getWhoAmI();
    expect(result.user.email).toBe("user@example.com");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps api errors into stable cli errors", async () => {
    const fetchImpl = mock(async (input: string | URL) => {
      expect(String(input)).toBe("http://localhost:4000/runs/deadbeef");
      return (
      new Response(
        JSON.stringify({
          isError: true,
          code: "NOT_FOUND",
          message: "Run not found.",
          retryable: false,
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      )
      );
    }) as unknown as typeof fetch;

    const client = createApiClient({
      apiUrl: "http://localhost:4000",
      token: "pat_123",
      fetchImpl,
    });

    await expect(client.getRun("deadbeef")).rejects.toBeInstanceOf(ApiError);
  });
});
