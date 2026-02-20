/**
 * Per-nullifier async lock to prevent check-then-act race conditions.
 * Two concurrent requests with the same nullifier will serialize:
 * the second waits until the first completes (success or error).
 *
 * Uses a Map of Promise chains keyed by nullifier hash.
 * No external dependencies — built on native Promises.
 */
export class NullifierLock {
  private locks = new Map<string, Promise<void>>();

  /**
   * Acquire locks for one or two nullifiers atomically.
   * Returns a release function that MUST be called in a finally block.
   *
   * Nullifiers are sorted before locking to prevent ABBA deadlocks
   * when two requests lock the same pair in different order.
   */
  async acquire(nullifiers: string[]): Promise<() => void> {
    // Deduplicate and sort to prevent deadlock
    const sorted = [...new Set(nullifiers)].sort();

    const releaseFns: (() => void)[] = [];

    for (const nf of sorted) {
      const existing = this.locks.get(nf) ?? Promise.resolve();
      let release: () => void;
      const next = new Promise<void>((resolve) => {
        release = resolve;
      });
      this.locks.set(nf, next);

      // Wait for the previous holder to finish
      await existing;

      releaseFns.push(() => {
        // Clean up map entry if this is the tail of the chain
        if (this.locks.get(nf) === next) {
          this.locks.delete(nf);
        }
        release!();
      });
    }

    return () => {
      for (const fn of releaseFns) {
        fn();
      }
    };
  }
}
