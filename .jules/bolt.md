## 2025-03-01 - High-Frequency Event State Anti-Pattern
**Learning:** In React, directly calling state setters (like `setIdleTime(0)`) on high-frequency events like `mousemove` causes excessive re-renders, even if the state is technically set to the same value (unless React batches it out, but the function call overhead still exists). Doing this continuously against an internal timer creates an unnecessary performance drag.
**Action:** Always throttle high-frequency event handlers (e.g., `mousemove`, `scroll`, `resize`) and implement bailout checks in state updates (`setIdleTime(prev => prev === 0 ? prev : 0)`) to ensure React avoids pointless reconciliation passes.

## 2026-08-24 - Associative Graph & Memory Node Lookup Anti-Pattern
**Learning:** In ADHD-SAGE's architecture, `buildMemoryContext()` in `index.tsx` was calling `queryAllEdges()` inside loops (globally sorting all graph edges $O(E \log E)$ per recent node) and concatenating memory state arrays (`[...memory.getInnerSpiral(), ...memory.getArchive()]`) to run linear $O(M)$ `.find()` searches. `queryTopNeighbors(n.id, k)` already exists in `associative-graph.ts` for targeted neighbor queries.
**Action:** When gathering contextual graph memory for prompt generation, always use `queryTopNeighbors()` and index memory collections into a `Map<string, MemoryNode>` once to achieve $O(1)$ node resolution instead of repeated array copying and global edge sorting.

## 2024-05-18 - React.memo with inline functions
**Learning:** Using `React.memo` is an anti-pattern when components have function props created inline (e.g. `onClick={() => {}}`). We should provide a custom comparison function to `React.memo` to ignore inline function prop changes, or refactor the code so the inline functions are defined using `useCallback` on the parent component.
**Action:** When wrapping components in `React.memo`, look at where the component is used to ensure no inline functions or objects are passed down, or provide a custom comparison function to `React.memo` that ignores them.
