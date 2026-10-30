#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/** Command-line interface for pepkio-well-plate-seeding-density-calculator. */

import { Command } from "commander";

import { PepkioClient } from "./client.js";
import { resolveApiKey, resolveBaseUrl } from "./config.js";
import { PepkioAPIError } from "./errors.js";

function createClient(apiKey?: string, baseUrl?: string): PepkioClient {
  const resolvedBase = resolveBaseUrl(baseUrl);
  return new PepkioClient({
    apiKey: apiKey ?? resolveApiKey(undefined, resolvedBase),
    baseUrl: resolvedBase,
  });
}

const program = new Command();

program
  .name("pepkio-well-plate-seeding-density-calculator")
  .description("TypeScript client for Pepkio well-plate-seeding-density-calculator")
  .option(
    "--api-key <key>",
    "Pepkio API key (tools:run scope); else LOCAL_PEPKIO_API_KEY or PEPKIO_API_KEY from env",
  )
  .option(
    "--base-url <url>",
    "Tools API base URL (default: https://tools.pepkio.com or PEPKIO_API_BASE_URL)",
  );

program
  .command("manifest")
  .description("Fetch and print the tool manifest")
  .option("--examples", "List example names only")
  .action(async (opts: { examples?: boolean }, cmd) => {
    const globals = cmd.parent?.opts() as { apiKey?: string; baseUrl?: string };
    try {
      const client = createClient(globals.apiKey, globals.baseUrl);
      const data = await client.getManifest();
      if (opts.examples) {
        const names = await client.listExamples();
        for (const name of names) {
          console.log(name);
        }
        return;
      }
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program
  .command("run")
  .description("Run the tool and print the result JSON")
  .option("--example <name>", "Run a named manifest example")
  .option("--input-json <json>", "Tool input as JSON object")
  .option("--label <label>", "Optional run label")
  .option("--idempotency-key <key>", "Optional idempotency key")
  .action(
    async (
      opts: {
        example?: string;
        inputJson?: string;
        label?: string;
        idempotencyKey?: string;
      },
      cmd,
    ) => {
      const globals = cmd.parent?.opts() as { apiKey?: string; baseUrl?: string };
      if (Boolean(opts.example) === Boolean(opts.inputJson)) {
        console.error("Provide exactly one of --example or --input-json");
        process.exit(1);
      }
      try {
        const client = createClient(globals.apiKey, globals.baseUrl);
        let input: Record<string, unknown>;
        if (opts.example) {
          input = await client.getExampleInput(opts.example);
        } else {
          const parsed = JSON.parse(opts.inputJson ?? "{}") as unknown;
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("--input-json must be a JSON object");
          }
          input = parsed as Record<string, unknown>;
        }
        const result = await client.run(input, {
          label: opts.label,
          idempotencyKey: opts.idempotencyKey,
        });
        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        if (err instanceof PepkioAPIError || err instanceof Error) {
          console.error(err.message);
        } else {
          console.error(String(err));
        }
        process.exit(1);
      }
    },
  );

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
