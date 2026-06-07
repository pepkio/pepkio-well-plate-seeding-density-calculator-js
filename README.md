# Pepkio Cell Seeding Density Calculator

ESM TypeScript client for scaling hemocytometer counts into per-well cell numbers and viability-corrected pipette volumes across six plate formats via the Pepkio Tools REST API.

# What It Does

Tissue culture seeding requires converting a stock cell concentration and target confluency into cells per well and microliters to pipette—often for multiple plate formats at once. This package calls the hosted Pepkio Cell Seeding Density Calculator over REST so you can run those calculations programmatically without reimplementing calculator logic locally.

Use it from Node.js (≥18), bundlers, or CI to fetch the tool manifest, run named examples, or submit custom input JSON. Each completed run returns per-plate `cells_per_well`, `volume_uL`, volume badges, optional time-to-confluency estimates, warnings, and an optional permalink to the same plan in the web UI.

# Features

- Six plate formats in one run: 6W, 12W, 24W, 48W, 96W, and 384W (well areas from Corning/Falcon manufacturer specs)
- Viability-adjusted pipette volumes from trypan blue counts
- Optional time-to-confluency estimate when `doubling_time_h` is provided
- Volume badges for low viability, exceeds well limit, below practical pipetting (384W), or ok
- Manifest helpers: `getManifest`, `listExamples`, `getExampleInput`
- `run`, `getRun`, and `waitForRun` for sync execution
- CLI: `pepkio-well-plate-seeding-density-calculator manifest` and `run`
- Configurable via `PEPKIO_API_KEY` and `PEPKIO_API_BASE_URL`

# Installation

```bash
npm install pepkio-well-plate-seeding-density-calculator
```

Requires Node.js 18 or newer.

# Configuration

Set an API key with **tools:run** scope before calling `run()`:

```bash
export PEPKIO_API_KEY="your-key"
```

Create a key at [Pepkio API keys](https://www.pepkio.com/account/api-keys).

Optional overrides:

| Variable | Purpose |
|----------|---------|
| `PEPKIO_API_KEY` | Production API key (required for `run`) |
| `LOCAL_PEPKIO_API_KEY` | Local dev key when `PEPKIO_API_BASE_URL` points to `tools.localtest.me` |
| `PEPKIO_API_BASE_URL` | API host (default `https://tools.pepkio.com`) |

# Quick Example

```typescript
import { PepkioClient } from "pepkio-well-plate-seeding-density-calculator";

const client = new PepkioClient({ apiKey: process.env.PEPKIO_API_KEY });

const input = await client.getExampleInput("hek293t_standard");
const result = await client.run(input);

console.log(result.result?.plates); // [{ format: "96W", cells_per_well: 22080, volume_uL: 11.62, ... }, ...]
console.log(result.permalink);      // shareable link to the web plan
```

# CLI

```bash
npx pepkio-well-plate-seeding-density-calculator manifest --examples
npx pepkio-well-plate-seeding-density-calculator run --example hek293t_standard
```

Pass `--base-url` and `--api-key` to override environment defaults.

# Typical Use Cases

- **HEK293T 96-well seeding** (`hek293t_standard`) — cells per well and volume at 30% seeding from a 2 M/mL stock with 95% viability
- **HeLa confluency timing** (`hela_seeding`) — estimate hours to assay confluency when seeding at 25% with doubling time set
- **Low viability warning** (`low_viability_warn`) — flag when trypan blue viability falls below practical thresholds
- **Invalid stock validation** (`invalid_stock`) — detect blocking errors when stock concentration is too low
- **CHO 384-well scaling** (`cho_384w`) — small-well volumes with below-pipette badges on 384W plates

# Scientific Background

Cells needed per well follow `(seeding_confluency_pct / 100) × cells_per_cm² × well_area_cm²`. Pipette volume in µL is `(cells_needed / (stock_concentration_cells_per_mL × viability_pct / 100)) × 1000`, so dead cells from trypan blue counts do not inflate the transfer. When doubling time is provided, hours to assay confluency use `log₂(assay_confluency_pct / seeding_confluency_pct) × doubling_time_h` (default assay target 80%). Well areas follow Corning/Falcon manufacturer specifications for each format.

# Web Application

For researchers who prefer a graphical interface, an interactive web version is available.

Web Application: https://www.pepkio.com/tools/well-plate-seeding-density-calculator

The web UI adds cell-line presets (~30 lines), a live plate grid, protocol copy for ELNs, CSV export, print reports, and browser session history. The npm package uses the same calculation engine via the REST API.

# Documentation and Resources

GitHub Repository: https://github.com/pepkio/pepkio-well-plate-seeding-density-calculator-js

Web Application: https://www.pepkio.com/tools/well-plate-seeding-density-calculator

# About Pepkio

Pepkio (https://www.pepkio.com/) develops software tools and bioinformatics solutions for life science researchers, including laboratory calculators and analysis services.
