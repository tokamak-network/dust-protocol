/**
 * Race a promise against a timeout. Rejects with a descriptive error
 * if the timeout fires first. The original promise is NOT cancelled
 * (Node.js doesn't support cancellation), but the result is discarded.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}
