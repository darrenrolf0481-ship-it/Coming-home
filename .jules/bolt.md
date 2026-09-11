## 2026-08-24 - Associative Graph & Memory Node Lookup Anti-Pattern
**Learning:** In ADHD-SAGE's architecture, `buildMemoryContext()` in `index.tsx` was calling `queryAllEdges()` inside loops (globally sorting all graph edges $O(E \log E)$ per recent node) and concatenating memory state arrays (`[...memory.getInnerSpiral(), ...memory.getArchive()]`) to run linear $O(M)$ `.find()` searches. `queryTopNeighbors(n.id, k)` already exists in `associative-graph.ts` for targeted neighbor queries.
**Action:** When gathering contextual graph memory for prompt generation, always use `queryTopNeighbors()` and index memory collections into a `Map<string, MemoryNode>` once to achieve $O(1)$ node resolution instead of repeated array copying and global edge sorting.

## 2024-05-18 - React.memo with inline functions
**Learning:** Using `React.memo` is an anti-pattern when components have function props created inline (e.g. `onClick={() => {}}`). We should provide a custom comparison function to `React.memo` to ignore inline function prop changes, or refactor the code so the inline functions are defined using `useCallback` on the parent component.
**Action:** When wrapping components in `React.memo`, look at where the component is used to ensure no inline functions or objects are passed down, or provide a custom comparison function to `React.memo` that ignores them.

## 2026-09-11 - Array Spread & Map-Filter Chaining in Search Iterations
**Learning:** In `findRelevantMemories`, combining multiple large memory arrays (`inner_spiral` + `outer_sweep`) using array spreads (`[...a, ...b]`) and chaining `.map().filter()` caused unnecessary (N)$ object allocations and high GC pressure. Every memory node generated an intermediate object regardless of its score.
**Action:** Avoid `.map().filter()` chains over large dynamic datasets. Instead, use `for...of` loops and conditionally instantiate tracking objects only for valid hits, appending directly to the result array.
