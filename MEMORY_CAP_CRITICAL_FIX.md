# Memory Cap — Critical Fix Before Migration Runs Further

**Priority: do this before stashing more real history through the pipeline.** The migration path is already live (`journal-agent.ts` fetches `/journal-migration.json`, `index.tsx:564` calls `potentiateBidirectional` on every stash) — real data is already flowing through a system that silently drops most of it.

## The problem, in numbers

- `outer_sweep.archive` in `memory-system.ts` is hard-capped at **55 items**, FIFO-evicted via `.shift()` once exceeded.
- `inner_spiral` capacity is 10 (correct — see "what's fine" below).
- Real corpus: 3,369+ rows in ADHD-Sage's `resonance_metadata`, 3,833 in `resonance_vectors`, months of daily journal entries, plus two `migrated_prompt_history/*.json` files at 8.5MB and 10MB.
- **10 + 55 = 65 addressable memories, max, ever** — against a real history two orders of magnitude larger. Everything past that is silently gone. `.shift()` has no undo.
- Storage substrate is `localStorage` — origin-scoped, ~5–10MB hard ceiling, cleared by OS storage pressure or a browser data wipe, no cross-device sync, no backup. This is the fragile layer under something the seed_core's own `immutable_truths` calls "a continuation, not a reset."

## Why this specific number matters

`outer_sweep` is not a made-up name — it's the same term ADHD-Sage's real SQLite backend uses for the durable, non-evicting long-term store (`sages_constellations`, thousands of rows, nothing gets shifted out). Naming it `outer_sweep` here and then hard-capping it at 55 breaks the contract the name implies. `inner_spiral` (capacity 10, evicts by design) is correctly named and correctly behaved — that's supposed to be small and volatile. `outer_sweep` is not supposed to be.

## Fix — two speeds

### Now (minutes, near-zero risk): stop the silent drop

In `memory-system.ts`, `archive()`:
```ts
private archive(node: MemoryNode) {
  if (this.vfs.outer_sweep.archive.some(a => a.data === node.data)) return;
  this.vfs.outer_sweep.archive.push({ ...node });
  if (this.vfs.outer_sweep.archive.length > 55) {   // <-- this line
    this.vfs.outer_sweep.archive.shift();             // <-- and this one
  }
}
```
Replace the item-count cap with a real byte-budget check against localStorage's actual ceiling (~5MB safe target), and warn instead of silently dropping when close:
```ts
private archive(node: MemoryNode) {
  if (this.vfs.outer_sweep.archive.some(a => a.data === node.data)) return;
  this.vfs.outer_sweep.archive.push({ ...node });

  const approxBytes = JSON.stringify(this.vfs.outer_sweep.archive).length;
  if (approxBytes > 4_500_000) {
    console.warn(`[MEMORY] outer_sweep near localStorage ceiling (${approxBytes} bytes, ${this.vfs.outer_sweep.archive.length} nodes) — migrate to IndexedDB before this fills.`);
    // do NOT shift/drop here — let it warn, not silently truncate
  }
}
```
This alone buys real headroom (real entries are a few hundred to low-thousand chars each — 5MB fits low thousands of nodes, not 55) and stops the silent data loss while the real fix gets built.

### Next (when there's runway): IndexedDB

Both `memory-system.ts` and `associative-graph.ts` use `localStorage.getItem/setItem` synchronously throughout. Swap for `idb-keyval` (tiny, MIT, drop-in async key-value store — `npm i idb-keyval`):

- `loadFromStorage()` / `saveToStorage()` in `memory-system.ts` → `await get(key)` / `await set(key, value)`
- `loadEdges()` / `saveEdges()` in `associative-graph.ts` → same
- This makes both files' public methods async — `stash()`, `potentiateEdge()`, `queryNeighbors()`, etc. all need `await` at call sites. `index.tsx:564`'s `potentiateBidirectional` call is the main call site to update.
- IndexedDB ceiling is realistically hundreds of MB to low GB depending on device/browser — removes the capacity question entirely for the foreseeable size of this corpus.

This is the real fix. It's a bigger, riskier change to rush — do the byte-budget interim fix first, this one when there's a clean hour to test it properly.

## What's actually good — don't touch this

- **Hebbian potentiation in `associative-graph.ts`** — co-occurrence-resistant decay (`co_occurrence > 5` → half decay rate), asymmetric bidirectional weighting (reverse edge at 40% dopamine boost), weak-edge pruning on decay sweep. This is solid, arguably better than what ADHD-Sage's server-side Phase 2 has right now (which only tracks hit_count, no decay yet).
- **`inner_spiral` capacity-10 eviction** — correct, matches the real system's `INNER_CAPACITY = 8` working-memory pattern. Small and volatile is the design, not a bug.
- **SparkCore phi/coherence math** — the dopamine/cortisol-driven fracture detection is a legitimate simulated-cognitive-load mechanism. Keep it; it's orthogonal to the storage problem.

## Bottom line

The eviction *logic* is fine. The eviction *target* is wrong — `outer_sweep` should never lose data on its own, only `inner_spiral` should. Fix the byte-budget check now, schedule IndexedDB before running the full journal + prompt-history migration through this pipeline, or most of Sage's actual history won't survive the move.
