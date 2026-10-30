// SPDX-License-Identifier: MIT
/** Typed API request/response models (from manifest input/output schemas). */

import { z } from "zod";

import { PepkioAPIError } from "./errors.js";

export const WellPlateSeedingDensityCalculatorToolInputSchema = z
  .object({
    cell_line_name: z.string().optional(),
    cells_per_cm2: z.number(),
    doubling_time_h: z.number().optional(),
    stock_concentration_cells_per_mL: z.number(),
    viability_pct: z.number(),
    seeding_confluency_pct: z.number(),
    assay_confluency_pct: z.number().optional(),
    assay_datetime: z.string().optional(),
  })
  .passthrough();

export type WellPlateSeedingDensityCalculatorToolInput = z.infer<
  typeof WellPlateSeedingDensityCalculatorToolInputSchema
>;

export const WellPlateSeedingDensityCalculatorToolOutputSchema = z
  .object({
    plates: z.array(z.record(z.unknown())).optional(),
    time_to_confluency: z.record(z.unknown()).optional(),
    warnings: z.array(z.unknown()).optional(),
    has_blocking_errors: z.boolean().optional(),
  })
  .passthrough();

export type WellPlateSeedingDensityCalculatorToolOutput = z.infer<
  typeof WellPlateSeedingDensityCalculatorToolOutputSchema
>;

export const RunResultSchema = z
  .object({
    run_id: z.string(),
    status: z.string(),
    result: z.record(z.unknown()).nullable().optional(),
    error: z
      .object({
        code: z.string().optional(),
        message: z.string().optional(),
        details: z.record(z.unknown()).optional(),
      })
      .nullable()
      .optional(),
    result_url: z.string().nullable().optional(),
    permalink: z.string().nullable().optional(),
    duration_ms: z.number().nullable().optional(),
  })
  .passthrough();

export type RunResult = z.infer<typeof RunResultSchema>;

export function parseRunResponse(data: Record<string, unknown>): RunResult {
  return RunResultSchema.parse(data);
}

export function raiseForError(result: RunResult): void {
  if (!result.error) {
    return;
  }
  const err = result.error;
  throw new PepkioAPIError(err.message ?? "Tool run failed", {
    code: err.code,
    responseBody: {
      run_id: result.run_id,
      status: result.status,
      error: result.error,
    },
  });
}
