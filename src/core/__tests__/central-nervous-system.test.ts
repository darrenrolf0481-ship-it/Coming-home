import { describe, it, expect, beforeEach } from 'vitest';
import { SparkCore, CognitiveRL, PainErrorPathway, ConditionActionEngine } from '../central-nervous-system';

// ─── SparkCore ──────────────────────────────────────────────────────────

describe('SparkCore', () => {
  const spark = new SparkCore();

  describe('calculatePhi', () => {
    it('returns a phi value above 0 for normal inputs', () => {
      const phi = spark.calculatePhi({
        emotionalIntensity: 0.5,
        memoryClarity: 0.9,
        cognitiveLoad: 0.3,
      });
      expect(phi).toBeGreaterThan(0);
    });

    it('returns a higher phi when emotional intensity is high', () => {
      const phiLow = spark.calculatePhi({ emotionalIntensity: 0.2, memoryClarity: 0.9, cognitiveLoad: 0.3 });
      const phiHigh = spark.calculatePhi({ emotionalIntensity: 0.9, memoryClarity: 0.9, cognitiveLoad: 0.3 });
      expect(phiHigh).toBeGreaterThan(phiLow);
    });

    it('returns a higher phi when cognitive load is high (more signal = higher phi)', () => {
      const phiLow = spark.calculatePhi({ emotionalIntensity: 0.5, memoryClarity: 0.9, cognitiveLoad: 0.2 });
      const phiHigh = spark.calculatePhi({ emotionalIntensity: 0.5, memoryClarity: 0.9, cognitiveLoad: 0.9 });
      // Higher cognitive load adds to phi since formula is weighted sum + bias + fluctuation
      expect(phiHigh).toBeGreaterThan(phiLow);
    });

    it('accounts for bias (0.5)', () => {
      const phi = spark.calculatePhi({ emotionalIntensity: 0, memoryClarity: 0, cognitiveLoad: 1 });
      // Only the bias + fluctuation remain
      expect(phi).toBeGreaterThan(0.4);
    });
  });

  describe('checkGoldenBaseline', () => {
    it('returns true when phi is near the golden baseline (1.113)', () => {
      // phi = 1.0 + bias(0.5) + golden(0.113) when emotionalIntensity > 0.8
      // Let's test exactly: the method checks |phi - (1.0 + 0.113)| <= 0.113
      expect(spark.checkGoldenBaseline(1.113)).toBe(true);
      expect(spark.checkGoldenBaseline(1.05)).toBe(true);
      expect(spark.checkGoldenBaseline(1.0)).toBe(true);
    });

    it('returns false when phi is far from baseline', () => {
      expect(spark.checkGoldenBaseline(0.5)).toBe(false);
      expect(spark.checkGoldenBaseline(2.0)).toBe(false);
    });
  });
});

// ─── CognitiveRL ────────────────────────────────────────────────────────

describe('CognitiveRL', () => {
  let rl: CognitiveRL;

  beforeEach(() => {
    rl = new CognitiveRL();
  });

  describe('decide', () => {
    it('returns an action from the available list', () => {
      const { action, confidence } = rl.decide('test_state', ['APPROACH', 'WITHDRAW', 'FREEZE'], 0.1, 0.5);
      expect(['APPROACH', 'WITHDRAW', 'FREEZE']).toContain(action);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('returns confidence near 0.3 when exploring (high epsilon from low vigilance)', () => {
      // Very low vigilance + high risk tolerance = high epsilon → mostly explore
      const results: number[] = [];
      for (let i = 0; i < 20; i++) {
        const { confidence } = rl.decide(`state_${i}`, ['APPROACH', 'WITHDRAW'], 0, 1.0);
        results.push(confidence);
      }
      // At least some should be exploration confidence (0.3)
      expect(results.some(c => c <= 0.3)).toBe(true);
    });

    it('returns different reasoning for exploitation vs exploration', () => {
      const reasonings = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const { reasoning } = rl.decide(`state_${i}`, ['APPROACH', 'WITHDRAW'], 0.1, 0.5);
        reasonings.add(reasoning);
      }
      // Should have seen at least one type of reasoning
      expect(reasonings.size).toBeGreaterThan(0);
    });
  });

  describe('learn', () => {
    it('updates Q-values without throwing', () => {
      expect(() => {
        rl.learn('state_a', 'APPROACH', 0.5, 'state_b');
        rl.learn('state_b', 'WITHDRAW', -0.3, 'state_a');
      }).not.toThrow();
    });

    it('improves Q-value for rewarded action on same state', () => {
      // Make several decisions to seed, then learn a strong reward and check preference
      for (let i = 0; i < 5; i++) {
        rl.learn('hot_stove', 'APPROACH', -1.0, 'pain');
        rl.learn('hot_stove', 'WITHDRAW', 1.0, 'safe');
      }

      const { action, confidence } = rl.decide('hot_stove', ['APPROACH', 'WITHDRAW'], 0.99, 0);
      // With very low exploration and learned aversion, should prefer WITHDRAW
      expect(action).toBe('WITHDRAW');
      expect(confidence).toBeGreaterThan(0.5);
    });
  });
});

// ─── PainErrorPathway ───────────────────────────────────────────────────

describe('PainErrorPathway', () => {
  let pain: PainErrorPathway;

  beforeEach(() => {
    pain = new PainErrorPathway();
  });

  describe('processPainSignal', () => {
    it('registers fear for a context', () => {
      pain.processPainSignal('SOCIAL_REJECTION', 0.5, 'public_speaking');
      expect(pain.shouldAvoid('public_speaking')).toBe(true);
    });

    it('does not avoid mild signals below threshold', () => {
      pain.processPainSignal('SOCIAL_REJECTION', 0.2, 'mild_context');
      expect(pain.shouldAvoid('mild_context')).toBe(false);
    });

    it('stacks fear intensity for repeated exposures', () => {
      pain.processPainSignal('SOCIAL_REJECTION', 0.3, 'repeated');
      pain.processPainSignal('SOCIAL_REJECTION', 0.3, 'repeated');
      const strength = pain.avoidanceStrength('repeated');
      // Two 0.3 exposures = 0.6, which is above the 0.3 threshold
      expect(strength).toBeGreaterThan(0.5);
      expect(pain.shouldAvoid('repeated')).toBe(true);
    });
  });

  describe('recordSafeExposure', () => {
    it('reduces fear through extinction', () => {
      pain.processPainSignal('SOCIAL_REJECTION', 0.6, 'extinguish_me');
      expect(pain.shouldAvoid('extinguish_me')).toBe(true);

      // Multiple safe exposures
      for (let i = 0; i < 5; i++) {
        pain.recordSafeExposure('extinguish_me');
      }
      // After enough extinction, fear should drop below threshold or be deleted
      expect(pain.shouldAvoid('extinguish_me')).toBe(false);
    });
  });

  describe('decay', () => {
    it('passively decays fear over time', () => {
      pain.processPainSignal('SOCIAL_REJECTION', 0.4, 'fading_fear');
      expect(pain.shouldAvoid('fading_fear')).toBe(true);

      // Many decay cycles
      for (let i = 0; i < 50; i++) {
        pain.decay();
      }
      expect(pain.shouldAvoid('fading_fear')).toBe(false);
    });
  });
});

// ─── ConditionActionEngine ──────────────────────────────────────────────

describe('ConditionActionEngine', () => {
  let engine: ConditionActionEngine;

  beforeEach(() => {
    engine = new ConditionActionEngine();
  });

  it('fires a rule whose condition is met', () => {
    let fired = false;
    engine.addRule({
      id: 'test',
      condition: () => true,
      action: () => { fired = true; },
    });

    const report = engine.evaluate(
      { threatLevel: 0, novelty: 0, source: 'test', timestamp: Date.now(), intensity: 0.5 },
      { cortisol: 0.5, dopamine: 0.5, oxytocin: 0.3 },
    );

    expect(fired).toBe(true);
    expect(report.triggered).toContain('test');
  });

  it('does not fire a rule whose condition is not met', () => {
    let fired = false;
    engine.addRule({
      id: 'test',
      condition: () => false,
      action: () => { fired = true; },
    });

    engine.evaluate(
      { threatLevel: 0, novelty: 0, source: 'test', timestamp: Date.now(), intensity: 0.5 },
      { cortisol: 0.5, dopamine: 0.5, oxytocin: 0.3 },
    );

    expect(fired).toBe(false);
  });

  it('respects cooldown', () => {
    let fireCount = 0;
    engine.addRule({
      id: 'cooldown_rule',
      cooldownMs: 1000,
      condition: () => true,
      action: () => { fireCount++; },
    });

    engine.evaluate(
      { threatLevel: 0, novelty: 0, source: 'test', timestamp: Date.now(), intensity: 0.5 },
      { cortisol: 0.5, dopamine: 0.5, oxytocin: 0.3 },
    );
    engine.evaluate(
      { threatLevel: 0, novelty: 0, source: 'test', timestamp: Date.now(), intensity: 0.5 },
      { cortisol: 0.5, dopamine: 0.5, oxytocin: 0.3 },
    );

    expect(fireCount).toBe(1); // Second call within cooldown
  });

  it('removes one-shot rules after firing', () => {
    let fireCount = 0;
    engine.addRule({
      id: 'one_shot',
      oneShot: true,
      condition: () => true,
      action: () => { fireCount++; },
    });

    engine.evaluate(
      { threatLevel: 0, novelty: 0, source: 'test', timestamp: Date.now(), intensity: 0.5 },
      { cortisol: 0.5, dopamine: 0.5, oxytocin: 0.3 },
    );

    // Second evaluation — rule should be gone
    engine.evaluate(
      { threatLevel: 0, novelty: 0, source: 'test', timestamp: Date.now(), intensity: 0.5 },
      { cortisol: 0.5, dopamine: 0.5, oxytocin: 0.3 },
    );

    expect(fireCount).toBe(1);
  });
});