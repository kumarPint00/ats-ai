/**
 * Promise-based counting semaphore.
 * Caps the number of simultaneous async operations (e.g. Groq API calls).
 *
 * Upgrade path: replace with BullMQ + Redis worker when scale requires distributed queuing.
 */

export class Semaphore {
  private running = 0;
  private queue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly timeoutMs: number
  ) {}

  /**
   * Acquire a slot. Resolves immediately if a slot is free,
   * otherwise queues the caller until one is released or the timeout fires.
   */
  acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove from queue and reject
        this.queue = this.queue.filter((e) => e.resolve !== resolve);
        reject(new Error("Server is busy. Please try again shortly."));
      }, this.timeoutMs);

      this.queue.push({ resolve, reject, timer });
    });
  }

  /**
   * Release a slot and wake the next waiter, if any.
   */
  release(): void {
    const next = this.queue.shift();
    if (next) {
      clearTimeout(next.timer);
      // Keep running count the same — the slot transfers directly to the next waiter
      next.resolve();
    } else {
      this.running--;
    }
  }
}

/** Singleton: at most 5 simultaneous Groq calls; queue waits up to 30 s. */
export const scanSemaphore = new Semaphore(5, 30_000);
