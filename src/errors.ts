/** API error types. */

export class PepkioAPIError extends Error {
  readonly statusCode?: number;
  readonly code?: string;
  readonly details: Record<string, unknown>;
  readonly responseBody?: Record<string, unknown>;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      code?: string;
      details?: Record<string, unknown>;
      responseBody?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = "PepkioAPIError";
    this.statusCode = options?.statusCode;
    this.code = options?.code;
    this.details = options?.details ?? {};
    this.responseBody = options?.responseBody;
  }

  override toString(): string {
    const parts = [this.message];
    if (this.code) {
      parts.push(`code=${this.code}`);
    }
    if (this.statusCode !== undefined) {
      parts.push(`status=${this.statusCode}`);
    }
    return parts.join(" ");
  }
}
