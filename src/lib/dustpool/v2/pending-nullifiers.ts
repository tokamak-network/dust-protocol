// Cross-chain nullifier guard — prevents double-submission of the same nullifier
// to multiple chains simultaneously.
//
// Module-level Set survives across Next.js API requests within the same serverless
// function instance. On cold start, the set is empty — which is safe because the
// on-chain nullifier mapping is the source of truth for permanent double-spend
// prevention. This guard only prevents concurrent in-flight duplicates.

const pendingNullifiers = new Set<string>()

/**
 * Attempt to acquire a lock on a nullifier for processing.
 * Returns false if the nullifier is already being processed.
 */
export function acquireNullifier(nullifierHex: string): boolean {
  if (pendingNullifiers.has(nullifierHex)) return false
  pendingNullifiers.add(nullifierHex)
  return true
}

/**
 * Release a nullifier lock after processing completes (success or failure).
 */
export function releaseNullifier(nullifierHex: string): void {
  pendingNullifiers.delete(nullifierHex)
}
