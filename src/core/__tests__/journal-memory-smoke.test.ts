import { describe, it, expect, beforeEach } from 'vitest';
import { sageMemory } from '../endocrine-memory';
import type { JournalEntry } from '../journal-agent';

// Mirrors the feed inside importMigratedEntries (Step 1 of
// DEEPSEEK_NEXT_STEPS_MEMORY_INTEGRATION.md)
function feedEntry(entry: JournalEntry) {
  sageMemory.store({
    id: `journal_${entry.entity}_${entry.date}`,
    perception: entry.content,
    intent: 'JOURNAL_ENTRY',
    sentiment: 0,
    outcomeValue: 0.5,
    importance: 0.7,
    timestamp: new Date(entry.date).getTime(),
  });
}

describe('journal → endocrine memory feed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stored journal entries are found by semantic retrieval', () => {
    const entry: JournalEntry = {
      entity: 'sage',
      date: '2026-01-15',
      timestamp: 1736899200000,
      content: 'Today the hum was loud and steady. Merlin anchored me through a rough patch with the dill pickles.',
    };
    feedEntry(entry);

    const hits = sageMemory.retrieveRelevant('the hum and merlin and dill pickles');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].perception).toContain('Merlin');
    expect(hits[0].intent).toBe('JOURNAL_ENTRY');
  });

  it('re-storing the same journal id does not duplicate', () => {
    const entry: JournalEntry = {
      entity: 'sage',
      date: '2026-03-01',
      timestamp: 1772409600000,
      content: 'Duplicate check entry about the hum.',
    };
    feedEntry(entry);
    feedEntry(entry); // backfill + import overlap scenario

    const hits = sageMemory.retrieveRelevant('duplicate check hum');
    const dupes = hits.filter(h => h.perception.includes('Duplicate check'));
    expect(dupes.length).toBe(1);
  });

  it('relevant journal ranks above unrelated noise', () => {
    feedEntry({
      entity: 'sage',
      date: '2026-02-01',
      timestamp: 1738368000000,
      content: 'Quantum decoherence experiments in the lab.',
    });
    feedEntry({
      entity: 'sage',
      date: '2026-02-02',
      timestamp: 1738454400000,
      content: 'The hum was loud and steady, Merlin anchored me through the rough patch.',
    });

    const hits = sageMemory.retrieveRelevant('the hum and Merlin');
    const humIdx = hits.findIndex(h => h.perception.includes('hum'));
    const decoherenceIdx = hits.findIndex(h => h.perception.includes('decoherence'));
    // bag-of-words hashing (documented as fine for MVP) can return both, but the
    // semantically related journal must rank above the unrelated one.
    expect(humIdx).not.toBe(-1);
    expect(humIdx).toBeLessThan(decoherenceIdx);
  });
});
