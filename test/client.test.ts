import { afterEach, describe, expect, it, vi } from "vitest";

import { PepkioClient } from "../src/client.js";
import { TOOL_ID } from "../src/config.js";
import { PepkioAPIError } from "../src/errors.js";
import { raiseForError } from "../src/types.js";
import { minimalValidInput, mockManifest, mockRunResponse } from "./fixtures.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeClient(fetchImpl: typeof fetch): PepkioClient {
  return new PepkioClient({
    apiKey: "test-key",
    baseUrl: "https://tools.example.com",
    fetch: fetchImpl,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PepkioClient unit tests", () => {
  it("caches manifest unless refresh is requested", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(new URL(url).pathname);
      expect(new URL(url).pathname).toBe(`/api/tools/v1/tools/${TOOL_ID}/manifest`);
      return jsonResponse(mockManifest);
    });

    const client = makeClient(fetchImpl);
    const m1 = await client.getManifest();
    const m2 = await client.getManifest();
    expect(m1.tool_id).toBe("well-plate-seeding-density-calculator");
    expect(m1).toBe(m2);
    expect(calls).toHaveLength(1);

    await client.getManifest({ refresh: true });
    expect(calls).toHaveLength(2);
  });

  it("lists examples and returns example input", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(mockManifest));
    const client = makeClient(fetchImpl);
    const names = await client.listExamples();
    expect(names).toContain("hek293t_standard");
    expect(names).toContain("hela_seeding");
    expect(names).toContain("low_viability_warn");
    expect(names).toContain("invalid_stock");
    expect(names).toContain("cho_384w");
    const input = await client.getExampleInput("hek293t_standard");
    expect(input.cell_line_name).toBe("HEK293T");
    expect(input.cells_per_cm2).toBe(230000);
  });

  it("throws when example is not found", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(mockManifest));
    const client = makeClient(fetchImpl);
    await client.getManifest();
    await expect(client.getExampleInput("missing")).rejects.toThrow(/not found/);
  });

  it("sends correct run request", async () => {
    const captured: Record<string, unknown> = {};
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const pathname = new URL(url).pathname;
      if (pathname.endsWith("/manifest")) {
        return jsonResponse(mockManifest);
      }
      captured.path = pathname;
      const headers = new Headers(init?.headers);
      captured.auth = headers.get("Authorization");
      captured.body = JSON.parse(String(init?.body));
      return jsonResponse(mockRunResponse);
    });

    const client = makeClient(fetchImpl);
    const result = await client.run(await client.getExampleInput("hek293t_standard"), {
      label: "vitest",
    });

    expect(captured.path).toBe(`/api/tools/v1/tools/${TOOL_ID}/run`);
    expect(captured.auth).toBe("Bearer test-key");
    expect((captured.body as Record<string, unknown>).input).toMatchObject({
      cell_line_name: "HEK293T",
    });
    expect((captured.body as Record<string, unknown>).options).toEqual({ label: "vitest" });
    expect(result.status).toBe("completed");
    expect(result.result?.has_blocking_errors).toBe(false);
    expect(Array.isArray(result.result?.plates)).toBe(true);
  });

  it("requires api key for run", async () => {
    vi.stubEnv("PEPKIO_API_KEY", "");
    vi.stubEnv("LOCAL_PEPKIO_API_KEY", "");
    const client = new PepkioClient({ baseUrl: "https://tools.example.com" });
    await expect(client.run(minimalValidInput)).rejects.toThrow(/API key required/);
  });

  it("raises on HTTP 401", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: { code: "UNAUTHORIZED", message: "Invalid API key", details: {} } },
        401,
      ),
    );
    const client = makeClient(fetchImpl);
    await expect(client.run(minimalValidInput)).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("raises on HTTP 400 validation error", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: { issues: {} },
          },
        },
        400,
      ),
    );
    const client = makeClient(fetchImpl);
    await expect(client.run(minimalValidInput)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("raises when run response includes error field", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        ...mockRunResponse,
        error: { code: "TOOL_FAILED", message: "bad input" },
      }),
    );
    const client = makeClient(fetchImpl);
    await expect(client.run(minimalValidInput)).rejects.toThrow(/bad input/);
  });

  it("raiseForError throws on failed run result", () => {
    expect(() =>
      raiseForError({
        run_id: "x",
        status: "failed",
        error: { code: "TOOL_FAILED", message: "failed" },
      }),
    ).toThrow(PepkioAPIError);
  });

  it("getRun fetches run by id", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(new URL(url).pathname).toBe("/api/tools/v1/runs/run_test123");
      return jsonResponse(mockRunResponse);
    });
    const client = makeClient(fetchImpl);
    const result = await client.getRun("run_test123");
    expect(result.run_id).toBe("run_test123");
  });
});
