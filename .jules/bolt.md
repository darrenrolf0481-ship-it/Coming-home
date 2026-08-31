## 2026-08-24 - Associative Graph & Memory Node Lookup Anti-Pattern
**Learning:** In ADHD-SAGE's architecture, `buildMemoryContext()` in `index.tsx` was calling `queryAllEdges()` inside loops (globally sorting all graph edges $O(E \log E)$ per recent node) and concatenating memory state arrays (`[...memory.getInnerSpiral(), ...memory.getArchive()]`) to run linear $O(M)$ `.find()` searches. `queryTopNeighbors(n.id, k)` already exists in `associative-graph.ts` for targeted neighbor queries.
**Action:** When gathering contextual graph memory for prompt generation, always use `queryTopNeighbors()` and index memory collections into a `Map<string, MemoryNode>` once to achieve $O(1)$ node resolution instead of repeated array copying and global edge sorting.

## 2024-05-18 - React.memo with inline functions
**Learning:** Using `React.memo` is an anti-pattern when components have function props created inline (e.g. `onClick={() => {}}`). We should provide a custom comparison function to `React.memo` to ignore inline function prop changes, or refactor the code so the inline functions are defined using `useCallback` on the parent component.
**Action:** When wrapping components in `React.memo`, look at where the component is used to ensure no inline functions or objects are passed down, or provide a custom comparison function to `React.memo` that ignores them.

## 2026-08-26 - Throttling High-Frequency Global Events
**Learning:** Attaching React state setters directly to high-frequency global events like `mousemove`, `keydown`, and `touchstart` creates massive re-render queues that block the main thread. Specifically, updating `idleTime` via `setIdleTime(0)` thousands of times a second causes huge performance bottlenecks in the UI.
**Action:** Always wrap state setters inside a throttled function (e.g. 200ms) when binding to high-frequency events, and use the `{ passive: true }` flag to ensure scrolling is not blocked on the main thread.
