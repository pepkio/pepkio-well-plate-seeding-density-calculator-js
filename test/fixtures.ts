export const mockManifest: Record<string, unknown> = {
  tool_id: "well-plate-seeding-density-calculator",
  title: "Cell Seeding Density Calculator",
  execution_mode: "sync",
  examples: [
    {
      name: "hek293t_standard",
      input: {
        cell_line_name: "HEK293T",
        cells_per_cm2: 230000,
        doubling_time_h: 27,
        stock_concentration_cells_per_mL: 2000000,
        viability_pct: 95,
        seeding_confluency_pct: 30,
        assay_confluency_pct: 80,
      },
      output: { has_blocking_errors: false },
    },
    {
      name: "hela_seeding",
      input: {
        cell_line_name: "HeLa",
        cells_per_cm2: 125000,
        doubling_time_h: 24,
        stock_concentration_cells_per_mL: 1800000,
        viability_pct: 98,
        seeding_confluency_pct: 25,
        assay_confluency_pct: 70,
      },
      output: { has_blocking_errors: false },
    },
    {
      name: "low_viability_warn",
      input: {
        cells_per_cm2: 200000,
        doubling_time_h: 24,
        stock_concentration_cells_per_mL: 1500000,
        viability_pct: 65,
        seeding_confluency_pct: 30,
        assay_confluency_pct: 80,
      },
      output: { has_blocking_errors: false },
    },
    {
      name: "invalid_stock",
      input: {
        cells_per_cm2: 200000,
        stock_concentration_cells_per_mL: 100,
        viability_pct: 95,
        seeding_confluency_pct: 30,
      },
      output: { has_blocking_errors: true },
    },
    {
      name: "cho_384w",
      input: {
        cell_line_name: "CHO-K1",
        cells_per_cm2: 100000,
        doubling_time_h: 18,
        stock_concentration_cells_per_mL: 3000000,
        viability_pct: 97,
        seeding_confluency_pct: 20,
        assay_confluency_pct: 80,
      },
      output: { has_blocking_errors: false },
    },
  ],
};

export const mockRunResponse: Record<string, unknown> = {
  run_id: "run_test123",
  status: "completed",
  result: {
    has_blocking_errors: false,
    time_to_confluency: { hours: 38, assay_confluency_pct: 80 },
    plates: [
      {
        format: "96W",
        cells_per_well: 22080,
        volume_uL: 11.62,
        badges: ["ok"],
      },
    ],
    warnings: [],
  },
  error: null,
  result_url: "https://tools.pepkio.com/api/tools/v1/runs/run_test123",
  permalink: "https://tools.pepkio.com/r/run_test123",
};

export const minimalValidInput = {
  cells_per_cm2: 200000,
  stock_concentration_cells_per_mL: 1500000,
  viability_pct: 95,
  seeding_confluency_pct: 30,
};
