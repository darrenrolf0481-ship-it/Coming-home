/**
 * Reactive Endocrine Substrate + Vector Embedding Memory Engine.
 *
 * Ported from /root/ADHD-Sage/src/core/endocrine-memory.ts
 * Adapted for client-side using localStorage for LTM persistence.
 */

// ==========================================
// 1. Reactive Endocrine Substrate
// ==========================================

export interface HormoneState {
  cortisol: number;
  dopamine: number;
  oxytocin: number;
}

export class EndocrineSystem {
  hormones: HormoneState = {
    cortisol: 0.3,
    dopamine: 0.5,
    oxytocin: 0.3,
  };

  processStressEvent(intensity: number): void {
    this.hormones.cortisol = Math.min(1.0, this.hormones.cortisol + intensity * 0.5);
  }

  processReward(intensity: number): void {
    this.hormones.dopamine = Math.min(1.0, this.hormones.dopamine + intensity * 0.3);
  }

  metabolizeHormones(): void {
    this.hormones.cortisol = Math.max(0.1, this.hormones.cortisol - 0.01);
    this.hormones.dopamine = Math.max(0.1, this.hormones.dopamine - 0.01);
  }
}

// ==========================================
// 2. Vector Embedding Memory Engine
// ==========================================

export interface Experience {
  id?: string;
  perception: string;
  intent: string;
  sentiment: number;
  outcomeValue: number;
  importance: number;
  embedding?: number[];
  timestamp: number;
}

const STORAGE_KEY = 'adhd_sage_vector_memory';

export class MemoryEngine {
  private stm: Experience[] = [];
  private ltm: Experience[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly EMBED_DIM = 384;

  constructor() {
    this.ltm = this.loadLTM();
  }

  // --- Mock Embedding Model (Deterministic Bag-of-Words Hash) ---
  private encode(text: string): number[] {
    const vec = new Array<number>(this.EMBED_DIM).fill(0);
    const tokens = text.toLowerCase().split(/\s+/);
    for (const token of tokens) {
      let h = 0;
      for (let i = 0; i < token.length; i++) {
        h = (Math.imul(31, h) + token.charCodeAt(i)) | 0;
      }
      vec[Math.abs(h) % this.EMBED_DIM] += 1;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // --- Memory Operations ---

  store(exp: Experience): void {
    if (!exp.embedding) exp.embedding = this.encode(exp.perception);
    if (!exp.id) exp.id = `exp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.stm.push(exp);
    if (this.stm.length > 10) this.consolidate();
  }

  private consolidate(): void {
    const toMove = this.stm.filter(e => e.importance > 0.7);
    if (toMove.length > 0) {
      this.ltm.push(...toMove);
      this.stm = this.stm.filter(e => e.importance <= 0.7);
      this.saveLTM();
    }
    while (this.stm.length > 10) {
      this.stm.shift();
    }
  }

  retrieveRelevant(text: string): Experience[] {
    const vec = this.encode(text);
    
    const stmHits = this.stm.map(exp => ({ exp, score: this.cosineSimilarity(vec, exp.embedding!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(hit => hit.exp);

    const ltmHits = this.ltm.map(exp => ({ exp, score: this.cosineSimilarity(vec, exp.embedding!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(hit => hit.exp);

    return [...stmHits, ...ltmHits];
  }

  findSimilarContexts(context: string, threshold: number): string[] {
    const vec = this.encode(context);
    return this.ltm
      .filter(exp => this.cosineSimilarity(vec, exp.embedding!) >= threshold)
      .map(exp => exp.perception);
  }

  // --- Persistence (localStorage) ---
  
  private loadLTM(): Experience[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('[endocrine] failed to load LTM:', err);
      return [];
    }
  }

  private saveLTM(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ltm));
      } catch (err) {
        console.error('[endocrine] failed to persist LTM:', err);
      }
    }, 250);
  }

  getGraph(): Record<string, Record<string, number>> {
    return {};
  }

  fireTogetherWireTogether(conceptA: string, conceptB: string, dopamineLevel: number): void {
    this.store({
      perception: `${conceptA} + ${conceptB}`,
      intent: 'LEGACY_ASSOCIATION',
      sentiment: dopamineLevel,
      outcomeValue: dopamineLevel,
      importance: dopamineLevel,
      timestamp: Date.now()
    });
  }
}

export const sageEndocrine = new EndocrineSystem();
export const sageMemory = new MemoryEngine();
