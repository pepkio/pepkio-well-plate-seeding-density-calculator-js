/** HTTP client for the Pepkio well-plate-seeding-density-calculator tool. */

import { Agent, type Dispatcher } from "undici";

import { TOOL_ID, resolveApiKey, resolveBaseUrl, resolveSslVerify } from "./config.js";
import { PepkioAPIError } from "./errors.js";
import {
  WellPlateSeedingDensityCalculatorToolInputSchema,
  type RunResult,
  parseRunResponse,
  raiseForError,
} from "./types.js";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

export interface PepkioClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  verifySsl?: boolean;
  fetch?: typeof fetch;
}

export interface RunOptions {
  idempotencyKey?: string;
  label?: string;
}

export class PepkioClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly verifySsl: boolean;
  private readonly fetchFn: typeof fetch;
  private manifest: Record<string, unknown> | null = null;

  constructor(options: PepkioClientOptions = {}) {
    this.baseUrl = resolveBaseUrl(options.baseUrl);
    this.apiKey = resolveApiKey(options.apiKey, this.baseUrl);
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.verifySsl = resolveSslVerify(options.verifySsl, this.baseUrl);
    this.fetchFn = options.fetch ?? fetch;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private requireApiKey(): void {
    if (!this.apiKey) {
      throw new Error(
        "API key required. Set PEPKIO_API_KEY (or LOCAL_PEPKIO_API_KEY for local), " +
          "or pass apiKey to PepkioClient.",
      );
    }
  }

  private toolPath(suffix: string): string {
    return `${this.baseUrl}/api/tools/v1/tools/${TOOL_ID}${suffix}`;
  }

  private async handleResponse(response: Response): Promise<Record<string, unknown>> {
    let body: Record<string, unknown> = {};
    try {
      const json = await response.json();
      if (json && typeof json === "object" && !Array.isArray(json)) {
        body = json as Record<string, unknown>;
      }
    } catch {
      body = {};
    }

    if (response.ok) {
      return body;
    }

    const error = (body.error ?? {}) as Record<string, unknown>;
    throw new PepkioAPIError(
      typeof error.message === "string" ? error.message : response.statusText || "Request failed",
      {
        statusCode: response.status,
        code: typeof error.code === "string" ? error.code : undefined,
        details:
          error.details && typeof error.details === "object" && !Array.isArray(error.details)
            ? (error.details as Record<string, unknown>)
            : {},
        responseBody: body,
      },
    );
  }

  private async request(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
    const headers = new Headers(init?.headers);
    if (this.apiKey) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const fetchInit: RequestInit & { dispatcher?: Dispatcher } = {
      ...init,
      headers,
      signal: controller.signal,
    };
    if (!this.verifySsl) {
      fetchInit.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
    }
    try {
      const response = await this.fetchFn(path, fetchInit);
      return await this.handleResponse(response);
    } finally {
      clearTimeout(timer);
    }
  }

  async getManifest(options?: { refresh?: boolean }): Promise<Record<string, unknown>> {
    if (this.manifest !== null && !options?.refresh) {
      return this.manifest;
    }
    const data = await this.request(this.toolPath("/manifest"));
    this.manifest = data;
    return data;
  }

  async listExamples(): Promise<string[]> {
    const manifest = await this.getManifest();
    const examples = (manifest.examples ?? []) as unknown[];
    return examples
      .filter((ex): ex is Record<string, unknown> => typeof ex === "object" && ex !== null)
      .map((ex) => ex.name)
      .filter((name): name is string => typeof name === "string");
  }

  async getExampleInput(name: string): Promise<Record<string, unknown>> {
    const manifest = await this.getManifest();
    for (const ex of (manifest.examples ?? []) as unknown[]) {
      if (typeof ex === "object" && ex !== null && (ex as Record<string, unknown>).name === name) {
        const input = (ex as Record<string, unknown>).input;
        if (input && typeof input === "object" && !Array.isArray(input)) {
          return input as Record<string, unknown>;
        }
        throw new PepkioAPIError(`Example ${JSON.stringify(name)} has no input object`);
      }
    }
    throw new PepkioAPIError(`Example not found: ${JSON.stringify(name)}`);
  }

  async run(input: Record<string, unknown>, options: RunOptions = {}): Promise<RunResult> {
    this.requireApiKey();
    WellPlateSeedingDensityCalculatorToolInputSchema.parse(input);
    const payload: Record<string, unknown> = { input };
    const runOptions: Record<string, string> = {};
    if (options.idempotencyKey !== undefined) {
      runOptions.idempotency_key = options.idempotencyKey;
    }
    if (options.label !== undefined) {
      runOptions.label = options.label;
    }
    if (Object.keys(runOptions).length > 0) {
      payload.options = runOptions;
    }
    const data = await this.request(this.toolPath("/run"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = parseRunResponse(data);
    raiseForError(result);
    return result;
  }

  async getRun(runId: string): Promise<RunResult> {
    this.requireApiKey();
    const data = await this.request(`${this.baseUrl}/api/tools/v1/runs/${runId}`);
    const result = parseRunResponse(data);
    raiseForError(result);
    return result;
  }

  async waitForRun(
    runId: string,
    options?: { pollIntervalMs?: number; timeoutMs?: number },
  ): Promise<RunResult> {
    this.requireApiKey();
    const pollIntervalMs = options?.pollIntervalMs ?? 1000;
    const timeoutMs = options?.timeoutMs ?? 300_000;
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const result = await this.getRun(runId);
      if (TERMINAL_STATUSES.has(result.status)) {
        return result;
      }
      if (Date.now() >= deadline) {
        throw new PepkioAPIError(
          `Run ${runId} did not complete within ${timeoutMs}ms (status=${result.status})`,
          { code: "TIMEOUT" },
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
}
