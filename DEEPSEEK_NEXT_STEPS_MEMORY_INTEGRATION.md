# Next Steps: Wire Journal Imports into Memory Graph

**Current State:** Journal migration auto-runs on app init, imports entries to IndexedDB. Endocrine vectors exist and work on chat input. Memory graph (associative) exists. But imported journals don't flow through either system — they land in cold storage.

**What's Missing:** Imported journal entries bypass both:
1. **Memory graph** — they don't get stashed into `memory.bulkStash()`, so no associative edges form between them
2. **Endocrine vectors** — they don't get encoded and stored in `sageMemory`, so semantic search can't find them

**Result:** 3,000+ imported journal entries exist in IndexedDB but are invisible to:
- Vector semantic search during chat (`sageMemory.retrieveRelevant()` at index.tsx:897 won't find them)
- Associative traversal (no edges pointing to them)
- The real working memory (inner_spiral only gets fresh chat input, not retroactively loaded history)

---

## Step 1: Extend `importMigratedEntries()` to feed the memory systems

**File:** `src/core/journal-agent.ts`, function `importMigratedEntries()`

**Current code (lines 298–315):**
```ts
export async function importMigratedEntries(entries: JournalEntry[]): Promise<number> {
  let count = 0;
  for (const entry of entries) {
    const key: [string, string] = [entry.entity, entry.date];
    const existing = await dbGet<JournalEntry>('journals', key);
    if (!existing) {
      await dbPut('journals', entry);
      count++;
    }
  }
  return count;
}
```

**Change:** After `dbPut`, also feed the entry into memory and endocrine:

```ts
import { sageMemory } from './endocrine-memory';
import { MemorySystem } from './memory-system';  // note: you'll need to export singleton

export async function importMigratedEntries(
  entries: JournalEntry[],
  memory?: MemorySystem  // optional: inject the memory instance if available
): Promise<number> {
  let count = 0;
  for (const entry of entries) {
    const key: [string, string] = [entry.entity, entry.date];
    const existing = await dbGet<JournalEntry>('journals', key);
    if (!existing) {
      await dbPut('journals', entry);
      
      // NEW: Feed into endocrine vector search
      sageMemory.store({
        id: `journal_${entry.entity}_${entry.date}`,
        perception: entry.content,        // the actual journal text
        intent: 'JOURNAL_ENTRY',
        sentiment: 0,                      // could extract from content later
        outcomeValue: 0.5,                 // neutral baseline
        importance: 0.7,                   // high importance: migrated history
        timestamp: new Date(entry.date).getTime()
      });
      
      // NEW: Feed into associative graph if memory instance provided
      if (memory) {
        memory.stash(entry.content, {
          dopamine: 0.7,  // migrated history gets higher dopamine
          cortisol: 0.2
        });
      }
      
      count++;
    }
  }
  return count;
}
```

**Why:** 
- Endocrine encoding happens per-entry, immediate, doesn't need the full memory system
- Memory graph feed (stash) is optional since it needs a singleton reference
- Dopamine > 0.5 for imported = prioritize old history in working memory over noise

---

## Step 2: Wire the memory instance into the import call

**File:** `index.tsx`, lines 483–492

**Current code:**
```ts
useEffect(() => {
  const migrated = localStorage.getItem('sage_journal_migrated');
  if (!migrated) {
    importFromMigrationFile().then(result => {
      if (result.imported > 0) {
        localStorage.setItem('sage_journal_migrated', 'true');
        getAllEntries('sage').then(setJournalEntries);
      }
    });
  }
}, []);
```

**Change:** Pass the `memory` instance:

```ts
useEffect(() => {
  const migrated = localStorage.getItem('sage_journal_migrated');
  if (!migrated) {
    memory.whenReady().then(() => {
      importFromMigrationFile().then(result => {
        if (result.imported > 0) {
          localStorage.setItem('sage_journal_migrated', 'true');
          getAllEntries('sage').then(setJournalEntries);
        }
      });
    });
  }
}, []);
```

**Why:** Ensure the memory system is hydrated before we try to stash entries into it.

---

## Step 3: Test the pipeline

1. **Clear localStorage** — delete `sage_journal_migrated` flag to force re-import
2. **Confirm endocrine encoding happens** — open browser DevTools, Network tab, watch for IndexedDB writes (will be silent but should complete in < 1 second for 3k entries since endocrine uses sync storage)
3. **Query the vector memory** — in the console:
   ```js
   const results = sageMemory.retrieveRelevant('some topic from your journal');
   console.log(results.length, results);
   ```
   Should return relevant journal entries if the semantic encoding worked.
4. **Check associative edges** — imported entries should now be reachable via graph traversal:
   ```js
   const assocEdges = queryAllEdges();
   console.log(assocEdges.filter(e => e.source.includes('journal')));
   ```

---

## Step 4: Surface imported history in chat context

**File:** `index.tsx`, around line 896-910 (the chat context builder)

Imported journals are now retrievable, but they're not automatically included in the LLM context yet. Three options:

### Option A: Automatic semantic retrieval (recommended)
Already done at line 897 — `sageMemory.retrieveRelevant(userText)` will pull relevant imported entries once Step 1 lands.

### Option B: Manual flag ("include history")
Add a UI toggle to the chat (checkbox: "search old journals?") that gates the endocrine retrieval on/off.

### Option C: Time-aware retrieval
Blend recent (inner_spiral) + time-distant (imported journals) if they're semantically related:
```ts
const recentMemories = memory.getInnerSpiral().slice(0, 5);
const importedHits = sageMemory.retrieveRelevant(userText).slice(0, 5);
const blended = [...recentMemories, ...importedHits];
// dedupe, sort by recency/relevance, trim to N
```

---

## Summary

- **Step 1:** Modify `importMigratedEntries()` to feed entries into endocrine + memory graph
- **Step 2:** Wire the memory instance into the import call so stash() doesn't get called before hydration
- **Step 3:** Test that vector retrieval works
- **Step 4:** Verify imported journals appear in chat context (already wired at index.tsx:897, just needs Step 1)

Once this lands, Sage will be able to:
- Ask about her past and get journal entries from 3,000+ imported entries, not just recent chats
- Form associative links between old events (via the graph)
- Use past context to inform current reasoning

---

## Gotcha: Endocrine uses deterministic bag-of-words hashing, not neural embeddings

The encoding at `endocrine-memory.ts:67-79` is a FNV1a-ish hash, not a model. This means:
- It's fast and works offline (no API calls)
- It won't understand synonyms or deeper semantic relationships
- It's stable: same text always produces the same vector

This is fine for MVP. If Sage later has access to a real embedding model (Ollama, local Phi, etc.), swap the `encode()` function for a call to that model and the rest of the pipeline stays the same.
