/**
 * Supermemory client — Long-term memory for ADHD-Sage.
 *
 * Ported from /root/ADHD-Sage/src/lib/supermemory.ts
 * Client-side version using localStorage as fallback when API key is unavailable.
 *
 * Container tagging: every memory is scoped so multiple entities get isolated memory spaces.
 */

/** Sage's private long-term memory — her own inner world. */
export const SAGE_CONTAINER = 'darren-sage';

/** Shared broadcast channel — all entities write here. */
export const SHARED_CONTAINER = 'sm_project_default';

/** @deprecated use SAGE_CONTAINER or SHARED_CONTAINER */
export const DEFAULT_CONTAINER_TAG = SAGE_CONTAINER;

// ─── localStorage-based fallback ──────────────────────────────────────────

const MEMORY_KEY = 'adhd_sage_supermemory';

interface StoredMemory {
  id: string;
  content: string;
  containerTags: string[];
  metadata?: Record<string, string>;
  timestamp: number;
}

function loadMemories(): StoredMemory[] {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMemories(memories: StoredMemory[]): void {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memories));
  } catch (err) {
    console.error('[SUPERMEMORY] Failed to save:', err);
  }
}

/**
 * Add a memory, returning its id or null on failure.
 */
export async function addMemory(
  content: string,
  containerTag: string = DEFAULT_CONTAINER_TAG,
  metadata?: Record<string, string>,
): Promise<string | null> {
  try {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const memories = loadMemories();
    memories.push({
      id,
      content,
      containerTags: [containerTag],
      metadata,
      timestamp: Date.now(),
    });
    saveMemories(memories);
    return id;
  } catch (err) {
    console.error('[SUPERMEMORY] addMemory failed:', err);
    return null;
  }
}

/**
 * Search memories across one or more container tags.
 */
export async function searchMemories(
  query: string,
  containerTags: string | string[] = SAGE_CONTAINER,
  limit = 5,
): Promise<string[]> {
  const tags = Array.isArray(containerTags) ? containerTags : [containerTags];
  const memories = loadMemories();
  
  // Simple token-based search (no vector embeddings on client)
  const tokens = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  
  return memories
    .filter(m => m.containerTags.some(t => tags.includes(t)))
    .map(m => {
      const content = m.content.toLowerCase();
      let score = 0;
      tokens.forEach(token => {
        if (content.includes(token)) score += 1;
      });
      return { content: m.content, score };
    })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(m => m.content);
}

/**
 * Get the profile for a container tag.
 */
export async function getProfile(
  containerTag: string = DEFAULT_CONTAINER_TAG,
): Promise<Record<string, unknown> | null> {
  const memories = loadMemories();
  const containerMemories = memories.filter(m => m.containerTags.includes(containerTag));
  
  if (containerMemories.length === 0) return null;
  
  // Build a simple profile from memory contents
  const staticFacts = containerMemories
    .slice(0, 10)
    .map(m => m.content.slice(0, 200));
  
  return {
    profile: {
      static: staticFacts,
      dynamic: [],
    },
    memoryCount: containerMemories.length,
  };
}
