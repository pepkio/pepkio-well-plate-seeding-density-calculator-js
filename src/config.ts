/** Configuration and environment resolution. */

export const DEFAULT_API_BASE_URL = "https://tools.pepkio.com";
export const TOOL_ID = "well-plate-seeding-density-calculator";

export function resolveBaseUrl(override?: string): string {
  return (override ?? process.env.PEPKIO_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export function resolveSslVerify(override?: boolean, baseUrl?: string): boolean {
  if (override !== undefined) {
    return override;
  }
  const env = process.env.PEPKIO_SSL_VERIFY;
  if (env !== undefined) {
    return !["0", "false", "no", "off"].includes(env.trim().toLowerCase());
  }
  const base = baseUrl ?? resolveBaseUrl();
  if (base.includes("localtest.me")) {
    return false;
  }
  return true;
}

export function resolveApiKey(override?: string, baseUrl?: string): string | undefined {
  if (override) {
    return override;
  }
  const base = baseUrl ?? resolveBaseUrl();
  if (base.includes("localtest.me")) {
    return process.env.LOCAL_PEPKIO_API_KEY ?? process.env.PEPKIO_API_KEY;
  }
  return process.env.PEPKIO_API_KEY;
}
