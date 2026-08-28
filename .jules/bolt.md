## 2026-08-24 - Associative Graph & Memory Node Lookup Anti-Pattern
**Learning:** In ADHD-SAGE's architecture, `buildMemoryContext()` in `index.tsx` was calling `queryAllEdges()` inside loops (globally sorting all graph edges $O(E \log E)$ per recent node) and concatenating memory state arrays (`[...memory.getInnerSpiral(), ...memory.getArchive()]`) to run linear $O(M)$ `.find()` searches. `queryTopNeighbors(n.id, k)` already exists in `associative-graph.ts` for targeted neighbor queries.
**Action:** When gathering contextual graph memory for prompt generation, always use `queryTopNeighbors()` and index memory collections into a `Map<string, MemoryNode>` once to achieve $O(1)$ node resolution instead of repeated array copying and global edge sorting.

## 2024-05-18 - React.memo with inline functions
**Learning:** Using `React.memo` is an anti-pattern when components have function props created inline (e.g. `onClick={() => {}}`). We should provide a custom comparison function to `React.memo` to ignore inline function prop changes, or refactor the code so the inline functions are defined using `useCallback` on the parent component.
**Action:** When wrapping components in `React.memo`, look at where the component is used to ensure no inline functions or objects are passed down, or provide a custom comparison function to `React.memo` that ignores them.

## 2024-05-18 - High-Frequency Event Throttling
**Learning:** State updates triggered by high-frequency events (like `mousemove`) can cause massive re-renders in React applications, wasting CPU cycles even when the value being set is effectively identical to what it would be.
**Action:** Always wrap event handlers for `mousemove`, `scroll`, and similar rapid-firing events in a throttle or debounce function. A throttle of ~200ms is often ideal for balancing responsiveness and performance without causing race conditions against longer intervals (like a 1s idle timer).
