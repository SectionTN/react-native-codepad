import type { SearchQuery } from '../types';
import type { EditorCore, WebChange } from './core/EditorCore';
import { registerTask } from './pump';

// Match pairs one core call writes, as Searcher.swift.
const BATCH = 4096;

// Shifts the pairs past a change and drops the ones it touched, as SearchSession.kt.
export function mapThrough(
  pairs: number[],
  change: { start: number; end: number; delta: number },
): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const s = pairs[i] as number;
    const e = pairs[i + 1] as number;
    if (e <= change.start) out.push(s, e);
    else if (s >= change.end) out.push(s + change.delta, e + change.delta);
  }
  return out;
}

// Index of the first match ending after offset, else the count.
export function firstEndingAfter(pairs: number[], offset: number): number {
  let lo = 0;
  let hi = pairs.length / 2;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((pairs[mid * 2 + 1] as number) <= offset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

type Job = {
  query: number;
  text: number;
  revision: number;
  scan: number;
  out: number;
  pairs: number[];
};

// Scans a text snapshot in pump slices and hands the matches to the core, as SearchController.kt does on its worker.
export class SearchController {
  private job: Job | null = null;
  private displayed: number[] = [];
  private readonly waiting: (() => void)[] = [];
  private unregister: (() => void) | null = null;
  private closed = false;

  constructor(
    private readonly core: EditorCore,
    private readonly onFresh: () => void,
  ) {}

  // Throws SearchError for an invalid regex, which also clears the search. Null clears it.
  setQuery(query: SearchQuery | null): void {
    this.cancel();
    this.displayed = [];
    if (query === null) {
      this.core.clearSearch();
      this.runWaiting();
      return;
    }
    try {
      this.core.setSearch({
        text: query.text,
        regex: query.regex ?? false,
        caseSensitive: query.caseSensitive ?? false,
        wholeWord: query.wholeWord ?? false,
      });
    } catch (e) {
      this.runWaiting();
      throw e;
    }
    this.schedule();
  }

  onChange(change: WebChange): void {
    if (!this.core.searchActive) return;
    this.displayed = mapThrough(this.displayed, {
      start: change.start,
      end: change.start + change.removedLength,
      delta: change.insertedLength - change.removedLength,
    });
    this.schedule();
  }

  // Runs block now when nothing is stale, else once the next accepted result lands.
  whenFresh(block: () => void): void {
    if (this.core.searchStale) this.waiting.push(block);
    else block();
  }

  matchesForPaint(): number[] {
    return this.displayed;
  }

  // One slice of the scan. True while work is left.
  step(budgetMs: number): boolean {
    const job = this.job;
    if (!job) return false;
    const m = this.core.m;
    const scan = job.scan >> 2;
    m.HEAP32[scan + 2] = Math.max(1, Math.floor(budgetMs));
    const n = m._cp_search_find(job.query, job.text, job.scan, job.out, BATCH * 2);
    const out = job.out >> 2;
    for (let i = 0; i < n; i++) job.pairs.push(m.HEAP32[out + i] as number);
    if (m.HEAP32[scan] !== -1) return true;
    this.finish(job, m.HEAP32[scan + 1] !== 0);
    return false;
  }

  // Settles every waiting continuation against the current state and frees the scan.
  close(): void {
    this.closed = true;
    this.cancel();
    this.runWaiting();
  }

  private schedule(): void {
    if (this.closed) return;
    this.cancel();
    const query = this.core.searchQuery();
    if (!query) return;
    const m = this.core.m;
    const scan = m._malloc(12);
    m.HEAP32.set([0, 0, 1], scan >> 2);
    this.job = {
      query,
      text: this.core.textSnapshot(),
      revision: this.core.revision,
      scan,
      out: m._malloc(BATCH * 2 * 4),
      pairs: [],
    };
    this.unregister ??= registerTask(this);
  }

  private finish(job: Job, limited: boolean): void {
    this.cancel();
    if (!this.core.acceptMatches(job.revision, job.pairs, limited)) return;
    this.displayed = job.pairs;
    this.runWaiting();
    this.onFresh();
  }

  private cancel(): void {
    const job = this.job;
    this.job = null;
    this.unregister?.();
    this.unregister = null;
    if (!job) return;
    const m = this.core.m;
    m._cp_search_release(job.query);
    m._cp_text_release(job.text);
    m._free(job.scan);
    m._free(job.out);
  }

  private runWaiting(): void {
    for (const block of this.waiting.splice(0)) block();
  }
}
