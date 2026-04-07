/**
 * Retry utility with exponential backoff.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  label?: string,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === maxAttempts) throw err;
      const delay = Math.min(1000 * 2 ** attempt, 30_000);
      console.warn(
        `[retry] ${label ?? "step"} attempt ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${(delay / 1000).toFixed(0)}s...`,
      );
      await sleep(delay);
    }
  }
  throw new Error("unreachable");
}
