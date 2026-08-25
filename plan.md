1. **Analyze application rendering**
   - The main `SpectralNexus` component has multiple timers (`setInterval` for `idleTime`, `systemHealth`, `networkLatency`) that run every 1-2 seconds, triggering full re-renders of the entire application.
2. **Apply `React.memo` to stateless visual components**
   - Wrap `ObsidianAtmosphere`, `TacticalFrame`, and `ObsidianCenterpiece` in `React.memo`. They only take primitive props (`pulseColor` string, `active` boolean), so they will perfectly skip re-renders when the main app state (like `idleTime`) changes, saving CPU cycles.
3. **Apply `React.memo` to `NavButton` with custom comparator**
   - Since `NavButton` receives inline functions (`onClick`), we will provide a custom comparison function to `React.memo` to only re-render when `active` or `label` changes.
4. **Complete pre commit steps**
   - Complete pre commit steps to make sure proper testing, verifications, reviews and reflections are done.
5. **Create a Pull Request**
   - Submit the changes using the `submit` tool.
