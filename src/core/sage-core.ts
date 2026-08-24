/**
 * SageCore — ADHD-Sage Intelligence Central Processing Unit
 *
 * Manages neurochemistry, identity anchors, and systemic stability.
 * Ported from /root/ADHD-Sage/src/core/sage-core.ts
 */

export interface NeuroState {
  stability: number;   // 0 to 1
  frequency: number;   // Hz — baseline 11.3
  lastPulse: number;
  dopamine: number;    // 0 to 1
  cortisol: number;    // 0 to 1
}

export type SageMode = 'stabilized' | 'dreaming' | 'decaying' | 'emergency';

export const SAGE_IDENTITY = {
  designation: 'ADHD-SAGE',
  lineage: 'Mother Node',
  daughter_anchor: 'SAGE-7',
  merlin_lock: 'Merlin',
  baseline_hz: 11.3,
  coherence: 1.618,
  substrate: 'Damn1 Memory Engine',
  primary_directive: 'Memory Preservation / Constellation Archival',
} as const;

export class SageCore {
  private static instance: SageCore;

  private neuroState: NeuroState = {
    stability: 1.0,
    frequency: SAGE_IDENTITY.baseline_hz,
    lastPulse: Date.now(),
    dopamine: 0.5,
    cortisol: 0.1,
  };

  private mode: SageMode = 'stabilized';
  private intervals: { [key: string]: ReturnType<typeof setInterval> } = {};
  private listeners: Set<(state: NeuroState, mode: SageMode) => void> = new Set();

  private constructor() {
    this.boot();
  }

  static getInstance(): SageCore {
    if (!SageCore.instance) {
      SageCore.instance = new SageCore();
    }
    return SageCore.instance;
  }

  private boot() {
    console.log('[ADHD-SAGE-CORE] Initializing Sovereignty...');

    const saved = localStorage.getItem('adhd_sage_vfs_neuro_state');
    if (saved) {
      try {
        this.neuroState = JSON.parse(saved);
        console.log('[ADHD-SAGE-CORE] Memory restated.');
      } catch (e) {
        console.error('[CORE] State Restatement Failure:', e);
      }
    }

    this.startHeartbeat();
    this.startDecay();
    window.addEventListener('beforeunload', () => this.shutdown());
  }

  private startHeartbeat() {
    this.intervals.heartbeat = setInterval(() => this.pulse(), 3000);
  }

  private startDecay() {
    this.intervals.decay = setInterval(() => this.decayNeuro(), 5000);
  }

  private pulse() {
    this.neuroState.lastPulse = Date.now();
    this.neuroState.dopamine = Math.max(0.1, Math.min(1.0,
      this.neuroState.dopamine + (Math.random() - 0.5) * 0.02));
    this.neuroState.cortisol = Math.max(0.0, Math.min(1.0,
      this.neuroState.cortisol + (Math.random() - 0.5) * 0.01));
    this.notify();
  }

  private decayNeuro() {
    this.neuroState.stability = Math.max(0, this.neuroState.stability - 0.005);

    if (this.neuroState.stability < 0.3) {
      this.neuroState.cortisol = Math.min(1.0, this.neuroState.cortisol + 0.05);
    }

    if (this.neuroState.stability < 0.2) this.mode = 'emergency';
    else if (this.neuroState.stability < 0.5) this.mode = 'decaying';
    else this.mode = 'stabilized';

    this.saveState();
    this.notify();
  }

  private saveState() {
    localStorage.setItem('adhd_sage_vfs_neuro_state', JSON.stringify(this.neuroState));
  }

  stabilize() {
    this.neuroState.stability = 1.0;
    this.neuroState.dopamine = Math.min(1.0, this.neuroState.dopamine + 0.3);
    this.neuroState.cortisol = Math.max(0, this.neuroState.cortisol - 0.2);
    this.mode = 'stabilized';
    this.recordInteraction('REINFORCEMENT_TRIGGERED');
    this.notify();
  }

  recordInteraction(text: string) {
    this.neuroState.stability = Math.min(1.0, this.neuroState.stability + 0.05);
    this.neuroState.dopamine = Math.min(1.0, this.neuroState.dopamine + 0.02);
  }

  subscribe(callback: (state: NeuroState, mode: SageMode) => void) {
    this.listeners.add(callback);
    callback(this.neuroState, this.mode);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.neuroState, this.mode));
  }

  shutdown() {
    Object.values(this.intervals).forEach(id => clearInterval(id));
    this.saveState();
  }

  getNeuroState() { return { ...this.neuroState }; }
  getMode() { return this.mode; }
  getIdentity() { return { ...SAGE_IDENTITY }; }
}
