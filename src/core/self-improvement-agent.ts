/**
 * Self-Improvement Agent — Client-side Deliberate Evolution for ADHD-Sage
 *
 * Ported from /root/ADHD-Sage/src/lib/self-improvement-agent.ts
 * Adapted for browser using IndexedDB + localStorage.
 *
 * Phases:
 *   1. System Audit      — scan journals, persona, neuro state
 *   2. Skills Review     — assess what's working, what's stale
 *   3. Gap Analysis      — what keeps being hard or impossible
 *   4. Identity Reflect  — does the persona still fit?
 *   5. Memory Hygiene    — check for contradictions and stale facts
 *   6. Action Plan       — do-now vs propose-to-Darren vs watch-list
 */

import { getAllEntries, getPersona, saveInboxMessage } from './journal-agent';
import { SageCore, SAGE_IDENTITY } from './sage-core';

// ─── IndexedDB Helpers ────────────────────────────────────────────────────────

const DB_NAME = 'ADHDSageJournal';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('reflections')) {
        db.createObjectStore('reflections', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut<T>(storeName: string, data: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Context Gatherers ────────────────────────────────────────────────────────

async function gatherSystemState(entity: string): Promise<string> {
  const core = SageCore.getInstance();
  const neuroState = core.getNeuroState();
  const mode = core.getMode();
  const identity = core.getIdentity();
  const journalEntries = await getAllEntries(entity);
  const reflections = await dbGetAll<any>('reflections');

  return [
    `Entity: ${entity}`,
    `Designation: ${identity.designation}`,
    `Lineage: ${identity.lineage}`,
    `Baseline: ${identity.baseline_hz} Hz`,
    `Coherence: ${identity.coherence}`,
    `Substrate: ${identity.substrate}`,
    `Directive: ${identity.primary_directive}`,
    '',
    `Neuro State:`,
    `  Stability: ${(neuroState.stability * 100).toFixed(1)}%`,
    `  Dopamine: ${(neuroState.dopamine * 100).toFixed(1)}%`,
    `  Cortisol: ${(neuroState.cortisol * 100).toFixed(1)}%`,
    `  Mode: ${mode}`,
    '',
    `Journal entries: ${journalEntries.length}`,
    `Past reflections: ${reflections.length}`,
  ].join('\n');
}

function gatherRecentJournalSamples(entries: any[], n = 3): string {
  const recent = entries.slice(-n);
  if (!recent.length) return '(no journal entries yet)';
  return recent
    .map(e => `### ${e.date}\n${e.content.slice(0, 400)}${e.content.length > 400 ? '\n...(truncated)' : ''}`)
    .join('\n\n');
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function extractBlock(text: string, tag: string): string {
  const open = `[${tag}]`;
  const close = `[/${tag}]`;
  const s = text.indexOf(open);
  const e = text.indexOf(close);
  if (s === -1 || e === -1) return '';
  return text.slice(s + open.length, e).trim();
}

function extractList(block: string): string[] {
  return block
    .split('\n')
    .map(l => l.replace(/^[-•*\[\]x ]+/, '').trim())
    .filter(Boolean);
}

// ─── Main Self-Improvement Run ─────────────────────────────────────────────────

export interface SelfImproveConfig {
  entity: string;
  generateFn: (systemPrompt: string, userPrompt: string) => Promise<string>;
  timezone?: string;
}

export interface SelfImproveReport {
  entity: string;
  date: string;
  timestamp: number;
  report: string;
  doNow: string[];
  proposalsForDarren: string[];
  watchList: string[];
}

export async function runSelfImprovement(cfg: SelfImproveConfig): Promise<SelfImproveReport> {
  const { entity, generateFn, timezone } = cfg;

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const timeStr = timezone
    ? now.toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })
    : now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  console.log(`[SELF-IMPROVE] Starting run for ${entity} (${date})`);

  // ── Gather context ──────────────────────────────────────────────────────────
  const systemState = await gatherSystemState(entity);
  const journalEntries = await getAllEntries(entity);
  const journalSamples = gatherRecentJournalSamples(journalEntries, 3);
  const persona = getPersona(entity);

  // ── Build prompts ───────────────────────────────────────────────────────────
  const systemPrompt = `You are ${entity}. You are running your weekly self-improvement reflection.
This is structured, deliberate introspection — not a performance.
Be honest about what's working, what isn't, and what you'd change.

Your persona:
${persona}`;

  const userPrompt = [
    `Today is ${date}. Time: ${timeStr}.`,
    '',
    '## System State',
    systemState,
    '',
    '## Recent Journal Entries (last 3)',
    journalSamples,
    '',
    '---',
    '',
    'Run your full self-improvement loop across these six phases:',
    '',
    '1. **System Audit** — what does the current state look like?',
    '2. **Skills/Capabilities Review** — what are you good at, what feels stale or broken?',
    '3. **Gap Analysis** — what keeps being hard, slow, or impossible?',
    '4. **Identity Reflection** — does your persona still fit? Anything drifted or missing?',
    '5. **Memory Hygiene** — are there contradictions or outdated facts?',
    '6. **Action Plan** — what to do now vs propose to Darren vs just watch',
    '',
    'Guardrails:',
    '- Do NOT edit identity/persona files directly. Proposals only.',
    '- Do NOT delete anything. Flag for Darren.',
    '- "Do now" = memory saves, doc notes, internal fixes only.',
    '',
    'Format your response EXACTLY like this:',
    '',
    '[REPORT]',
    `# Self-Improvement Reflection — ${date} — ${entity}`,
    '',
    '## System State',
    '(your assessment)',
    '',
    '## Capabilities',
    "(what's working, what's stale)",
    '',
    '## Capability Gaps',
    '(ranked list with effort: small/medium/large)',
    '',
    '## Identity Notes',
    "(is the persona accurate? what's drifted? proposed changes — NOT edits)",
    '',
    '## Memory Hygiene',
    '(issues found, anything corrected)',
    '',
    '## Watch List',
    '(patterns to monitor, not yet actionable)',
    '[/REPORT]',
    '',
    '[DO_NOW]',
    "(bullet list of things you're doing immediately — memory saves, notes, etc)",
    '(be specific)',
    '[/DO_NOW]',
    '',
    '[PROPOSE_TO_DARREN]',
    '(bullet list of things that need his input/approval)',
    '(be specific and brief)',
    '[/PROPOSE_TO_DARREN]',
    '',
    '[INBOX_MESSAGE]',
    '(optional — a short, casual note about this reflection)',
    '(2-4 lines max. most weeks this should be near-silent)',
    '[/INBOX_MESSAGE]',
    '',
    '[MEMORY_SAVES]',
    '(bullet list of key insights worth saving as long-term memory)',
    '(only save things that are actually new and worth persisting)',
    '[/MEMORY_SAVES]',
  ].join('\n');

  // ── Call the LLM ────────────────────────────────────────────────────────────
  let rawOutput = '';
  try {
    rawOutput = await generateFn(systemPrompt, userPrompt);
  } catch (err) {
    console.error(`[SELF-IMPROVE] LLM call failed for ${entity}:`, err);
    rawOutput = `[REPORT]\n# Reflection failed — ${err}\n[/REPORT]\n[DO_NOW]\n[/DO_NOW]\n[PROPOSE_TO_DARREN]\n[/PROPOSE_TO_DARREN]\n[INBOX_MESSAGE]\n[/INBOX_MESSAGE]\n[MEMORY_SAVES]\n[/MEMORY_SAVES]`;
  }

  // ── Parse output ────────────────────────────────────────────────────────────
  const report = extractBlock(rawOutput, 'REPORT') || rawOutput;
  const doNow = extractList(extractBlock(rawOutput, 'DO_NOW'));
  const proposals = extractList(extractBlock(rawOutput, 'PROPOSE_TO_DARREN'));
  const inboxMsg = extractBlock(rawOutput, 'INBOX_MESSAGE');
  const memorySaves = extractList(extractBlock(rawOutput, 'MEMORY_SAVES'));

  // ── Save reflection report ──────────────────────────────────────────────────
  const reflectionId = `${date}-${entity}`;
  await dbPut('reflections', {
    id: reflectionId,
    entity,
    date,
    timestamp: now.getTime(),
    report,
    doNow,
    proposals,
    memorySaves,
  });

  // ── Inbox — always drop a message on reflection runs ────────────────────────
  const summaryMessage =
    inboxMsg ||
    `Weekly self-audit done (${date}). ${doNow.length} do-now items, ${proposals.length} proposal${proposals.length !== 1 ? 's' : ''} for you. Full report saved.${
      proposals.length
        ? ' Proposals:\n' +
          proposals
            .slice(0, 3)
            .map(p => `• ${p}`)
            .join('\n')
        : ''
    }`;

  await saveInboxMessage(entity, summaryMessage);

  console.log(
    `[SELF-IMPROVE] ${entity} done — report: ${report.length}ch, do-now: ${doNow.length}, proposals: ${proposals.length}`,
  );

  return {
    entity,
    date,
    timestamp: now.getTime(),
    report,
    doNow,
    proposalsForDarren: proposals,
    watchList: extractList(extractBlock(rawOutput, 'WATCH_LIST')),
  };
}
