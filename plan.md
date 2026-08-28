1. **Optimize Event Listeners for `resetIdle`**
   - In `index.tsx`, the `resetIdle` function updates state (`setIdleTime(0)`) on every single `mousemove`, `keydown`, and `touchstart` event.
   - This causes massive amounts of unnecessary React re-renders when a user simply moves their mouse across the screen.
   - I will implement a custom `useThrottle` hook or a simple local variable throttling mechanism within the `useEffect` so that the `resetIdle` function only calls `setIdleTime` at most once every few hundred milliseconds, or only if `idleTime` is not already `0`.
   - Actually, since `resetIdle` just sets `setIdleTime(0)`, we can optimize it by checking if `idleTime` is already 0. Wait, `setIdleTime(0)` still might trigger a re-render if React doesn't bail out or if it causes unnecessary state updates. Better yet, we can use a ref to track if we need to reset, or just throttle the event listener.
   - A simpler approach: use a module-level or effect-level throttle.
2. **Implement the Optimization**
   - Create a simple throttle wrapper for `resetIdle` inside the `useEffect` in `index.tsx`.
3. **Verify functionality and performance**
   - Run tests to ensure nothing broke.
4. **Complete Pre-Commit Steps**
   - Ensure proper testing, verification, review, and reflection are done.
5. **Create Journal Entry**
   - Add an entry to `.jules/bolt.md` documenting the optimization of high-frequency DOM events triggering React state updates without throttling.
6. **Submit PR**
   - Submit the PR with the performance improvement.
