/** Integration tests against live Pepkio Tools API. */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";

import { PepkioClient } from "../src/client.js";
import { PepkioAPIError } from "../src/errors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const monorepoEnv = resolve(__dirname, "../../../.env");
if (existsSync(monorepoEnv)) {
  loadEnv({ path: monorepoEnv });
}

const packageEnv = resolve(__dirname, "../.env");
if (existsSync(packageEnv)) {
  loadEnv({ path: packageEnv });
}

const ENVIRONMENTS = [
  { name: "local", baseUrl: "https://tools.localtest.me" },
  { name: "production", baseUrl: "https://tools.pepkio.com" },
] as const;

const EXPECTED_EXAMPLES = [
  "hek293t_standard",
  "hela_seeding",
  "low_viability_warn",
  "invalid_stock",
  "cho_384w",
] as const;

function resolveEnvironments(): Array<{ name: string; baseUrl: string }> {
  const override = process.env.PEPKIO_API_BASE_URL;
  if (override) {
    const name = override.includes("localtest.me") ? "local" : "production";
    return [{ name, baseUrl: override.replace(/\/$/, "") }];
  }
  return [...ENVIRONMENTS];
}

function apiKeyFor(baseUrl: string): string | undefined {
  if (baseUrl.includes("localtest.me")) {
    return process.env.LOCAL_PEPKIO_API_KEY ?? process.env.PEPKIO_API_KEY;
  }
  return process.env.PEPKIO_API_KEY;
}

describe.each(resolveEnvironments())("$name integration", (env) => {
  let client: PepkioClient | null = null;
  let skipReason: string | null = null;

  beforeAll(async () => {
    const apiKey = apiKeyFor(env.baseUrl);
    if (!apiKey) {
      skipReason = `No API key for ${env.name} (set LOCAL_PEPKIO_API_KEY or PEPKIO_API_KEY)`;
      return;
    }
    const candidate = new PepkioClient({ apiKey, baseUrl: env.baseUrl });
    try {
      await candidate.getManifest({ refresh: true });
      client = candidate;
    } catch (err) {
      if (
        err instanceof PepkioAPIError &&
        err.statusCode === 404 &&
        err.code === "TOOL_NOT_FOUND"
      ) {
        skipReason = `Tool not deployed on ${env.name} (${env.baseUrl})`;
        return;
      }
      throw err;
    }
  });

  function liveIt(name: string, fn: (c: PepkioClient) => Promise<void>) {
    it(name, async () => {
      if (skipReason || !client) {
        return;
      }
      await fn(client);
    });
  }

  liveIt("fetches manifest", async (c) => {
    const manifest = await c.getManifest({ refresh: true });
    expect(manifest.tool_id).toBe("well-plate-seeding-density-calculator");
    const names = await c.listExamples();
    for (const expected of EXPECTED_EXAMPLES) {
      expect(names).toContain(expected);
    }
  });

  liveIt("runs hek293t_standard example", async (c) => {
    const input = await c.getExampleInput("hek293t_standard");
    const result = await c.run(input);
    expect(result.status).toBe("completed");
    expect(result.run_id).toBeTruthy();
    expect(result.permalink).toBeTruthy();
    expect(result.result).toBeTruthy();
    expect(result.result?.has_blocking_errors).toBe(false);
    const plates = result.result?.plates as unknown[] | undefined;
    expect(Array.isArray(plates)).toBe(true);
    expect((plates ?? []).length).toBeGreaterThanOrEqual(1);
    const plate96 = (plates ?? []).find(
      (p) => typeof p === "object" && p !== null && (p as Record<string, unknown>).format === "96W",
    ) as Record<string, unknown> | undefined;
    expect(plate96).toBeTruthy();
    expect(typeof plate96?.cells_per_well).toBe("number");
    expect(typeof plate96?.volume_uL).toBe("number");
  });

  liveIt("runs hela_seeding example", async (c) => {
    const input = await c.getExampleInput("hela_seeding");
    const result = await c.run(input);
    expect(result.status).toBe("completed");
    expect(result.result).toBeTruthy();
    expect(result.result?.has_blocking_errors).toBe(false);
  });

  liveIt("runs low_viability_warn example", async (c) => {
    const input = await c.getExampleInput("low_viability_warn");
    const result = await c.run(input);
    expect(result.status).toBe("completed");
    expect(result.result).toBeTruthy();
    expect(Array.isArray(result.result?.warnings)).toBe(true);
    expect((result.result?.warnings as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  liveIt("runs invalid_stock example", async (c) => {
    const input = await c.getExampleInput("invalid_stock");
    const result = await c.run(input);
    expect(result.status).toBe("completed");
    expect(result.result).toBeTruthy();
    expect(result.result?.has_blocking_errors).toBe(true);
  });

  liveIt("runs cho_384w example", async (c) => {
    const input = await c.getExampleInput("cho_384w");
    const result = await c.run(input);
    expect(result.status).toBe("completed");
    expect(result.result).toBeTruthy();
    expect(result.result?.has_blocking_errors).toBe(false);
    const plates = result.result?.plates as unknown[] | undefined;
    const plate384 = (plates ?? []).find(
      (p) => typeof p === "object" && p !== null && (p as Record<string, unknown>).format === "384W",
    ) as Record<string, unknown> | undefined;
    expect(plate384).toBeTruthy();
    expect(Array.isArray(plate384?.badges)).toBe(true);
    expect((plate384?.badges as unknown[]).includes("below_pipette")).toBe(true);
  });
});
