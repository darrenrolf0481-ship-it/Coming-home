1. **Analyze high-frequency event handlers:** The application sets an idle timer in `index.tsx` by attaching `resetIdle` directly to `mousemove`, `keydown`, and `touchstart` events.
2. **Implement throttling:** Create a throttled version of `resetIdle` using a 200ms timeout to prevent massive re-render queues caused by rapid `setIdleTime(0)` calls. Add passive flags where applicable to avoid blocking main thread scrolling.
3. **Verify:** Check that the application compiles, `npm run test` passes, and `npm run build` succeeds.
4. **Pre-commit Steps:** Ensure proper testing, verification, review, and reflection are done before submitting.
5. **Update journal and Submit:** Add a critical learning journal entry about high-frequency event throttling, and submit the PR as Bolt.
