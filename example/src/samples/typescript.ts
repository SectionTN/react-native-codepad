export const typescript = `// Retry a request a few times before giving up.
import { setTimeout as sleep } from "node:timers/promises";

type Status = "idle" | "loading" | "done";

interface Job<T> {
  id: number;
  run(): Promise<T>;
  status: Status;
}

const MAX_ATTEMPTS = 3;

export async function withRetry<T>(job: Job<T>, attempts = MAX_ATTEMPTS): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      job.status = "loading";
      return await job.run();
    } catch (error) {
      console.warn(\`job \${job.id} failed on attempt \${i + 1}\`, error);
      await sleep(100 * 2 ** i);
    }
  }
  job.status = "done";
  return null;
}
`;
