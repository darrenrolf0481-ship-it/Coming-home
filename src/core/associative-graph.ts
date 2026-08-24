/**
 * associative-graph.ts — Client-side port of ADHD-Sage's Associative Memory Graph.
 *
 * The edge/potentiation layer for ADHD-Sage. Ported from
 * /root/ADHD-Sage/src/server/associative-graph.ts (SQLite) to a browser
 * localStorage-backed store so the Coming-home UI can persist Hebbian edges
 * without a server.
 *
 * Hebbian rule: fire together, wire together — edges potentiate by a
 * dopamine-gated delta and decay over time; weak edges get pruned.
 */

import { memory } from './memory-system';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EdgeRelation = 'semantic' | 'causal' | 'taxonomic' | 'cross_vault';

export interface AssociativeEdge {
  edge_id: number;
  source_id: string;
  target_id: string;
  relation: EdgeRelation;
  weight: number;
  co_occurrence: number;
  last_fired: number | null;
  decay_rate: number;
  provenance: string | null;
}

export interface EdgeInput {
  source_id: string;
  target_id: string;
  relation?: EdgeRelation;
  weight?: number;
  provenance?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  pinned: boolean;
  dopamine: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  relation: string;
  co_occurrence: number;
}

export interface GraphJSON {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Persistence (localStorage) ───────────────────────────────────────────────

const STORAGE_KEY = 'adhd_sage_assoc_edges';

function loadEdges(): AssociativeEdge[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('[ASSOC-GRAPH] failed to load edges:', err);
    return [];
  }
}

function saveEdges(edges: AssociativeEdge[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(edges));
  } catch (err) {
    console.error('[ASSOC-GRAPH] failed to persist edges:', err);
  }
}

function nextEdgeId(edges: AssociativeEdge[]): number {
  return edges.reduce((max, e) => Math.max(max, e.edge_id), 0) + 1;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/** Insert a new edge. No-op if (source, target, relation) already exists. */
export function insertEdge(input: EdgeInput): AssociativeEdge | null {
  const edges = loadEdges();
  const relation = input.relation ?? 'semantic';
  const weight = clampWeight(input.weight ?? 0.1);

  const existing = findEdge(edges, input.source_id, input.target_id, relation);
  if (existing) return existing;

  const edge: AssociativeEdge = {
    edge_id: nextEdgeId(edges),
    source_id: input.source_id,
    target_id: input.target_id,
    relation,
    weight,
    co_occurrence: 1,
    last_fired: Date.now(),
    decay_rate: 0.02,
    provenance: input.provenance ?? null,
  };
  edges.push(edge);
  saveEdges(edges);
  return edge;
}

/**
 * Hebbian potentiation: strengthen an edge by a dopamine-gated delta.
 * Creates the edge if it doesn't exist yet.
 */
export function potentiateEdge(
  source_id: string,
  target_id: string,
  dopamine: number,
  relation: EdgeRelation = 'semantic',
  provenance?: string,
): AssociativeEdge {
  const edges = loadEdges();
  const existing = findEdge(edges, source_id, target_id, relation);

  if (existing) {
    // Hebbian: fire together, wire together
    const delta = clampDopamine(dopamine) * 0.1;
    existing.weight = clampWeight(existing.weight + delta);
    existing.co_occurrence += 1;
    existing.last_fired = Date.now();
    if (provenance) existing.provenance = provenance;
    saveEdges(edges);
    return existing;
  }

  // New edge — initial weight proportional to dopamine
  const initWeight = clampWeight(0.1 + clampDopamine(dopamine) * 0.2);
  const edge: AssociativeEdge = {
    edge_id: nextEdgeId(edges),
    source_id,
    target_id,
    relation,
    weight: initWeight,
    co_occurrence: 1,
    last_fired: Date.now(),
    decay_rate: 0.02,
    provenance: provenance ?? null,
  };
  edges.push(edge);
  saveEdges(edges);
  return edge;
}

/**
 * Bidirectionally potentiate: creates/strengthens edges in both directions
 * so the graph is traversable from either node.
 */
export function potentiateBidirectional(
  source_id: string,
  target_id: string,
  dopamine: number,
  relation: EdgeRelation = 'semantic',
  provenance?: string,
): { forward: AssociativeEdge; reverse: AssociativeEdge } {
  const forward = potentiateEdge(source_id, target_id, dopamine, relation, provenance);
  // Reverse edge: same relation but only 40% the dopa boost
  const reverse = potentiateEdge(target_id, source_id, dopamine * 0.4, relation, provenance);
  return { forward, reverse };
}

// ─── Query ────────────────────────────────────────────────────────────────────

/** Get all neighbors (inbound + outbound) for a node, sorted by weight. */
export function queryNeighbors(node_id: string): AssociativeEdge[] {
  const edges = loadEdges();
  return edges
    .filter(e => e.source_id === node_id || e.target_id === node_id)
    .sort((a, b) => b.weight - a.weight);
}

/** Get the K strongest neighbors for a node. */
export function queryTopNeighbors(node_id: string, k: number): AssociativeEdge[] {
  return queryNeighbors(node_id).slice(0, k);
}

/** Get all edges in the graph. */
export function queryAllEdges(): AssociativeEdge[] {
  return loadEdges().sort((a, b) => b.weight - a.weight);
}

/** Get all edges for a specific relation type. */
export function queryByRelation(relation: EdgeRelation): AssociativeEdge[] {
  return loadEdges()
    .filter(e => e.relation === relation)
    .sort((a, b) => b.weight - a.weight);
}

/** Check if two nodes have any edge between them. */
export function areConnected(node_id_a: string, node_id_b: string): boolean {
  return loadEdges().some(
    e =>
      (e.source_id === node_id_a && e.target_id === node_id_b) ||
      (e.source_id === node_id_b && e.target_id === node_id_a),
  );
}

/** Total number of edges. */
export function edgeCount(): number {
  return loadEdges().length;
}

// ─── Decay ────────────────────────────────────────────────────────────────────

/**
 * Decay all edges by a given rate, then prune weak ones.
 * Consolidated edges (co_occurrence > 5) decay at half the given rate.
 */
export function decayAllEdges(
  rate: number = 0.02,
  threshold: number = 0.05,
): { decayed: number; pruned: number } {
  const edges = loadEdges();
  let pruned = 0;

  const surviving = edges.filter(e => {
    let decayRate = rate;
    if (e.co_occurrence > 5) decayRate = rate / 2; // consolidated — half decay
    e.weight = clampWeight(e.weight * (1.0 - decayRate));
    if (e.weight < threshold) {
      pruned += 1;
      return false;
    }
    return true;
  });

  saveEdges(surviving);
  return { decayed: edges.length - surviving.length + pruned, pruned };
}

// ─── Graph Export (for UI) ────────────────────────────────────────────────────

/**
 * Build a JSON adjacency graph for the UI. Node labels are looked up from the
 * memory system's inner spiral + archive (replaces the sages_constellations
 * SQLite lookup in the server port).
 */
export function getGraphJSON(opts?: { node_id?: string; minWeight?: number }): GraphJSON {
  const minWeight = opts?.minWeight ?? 0.0;
  const edges = opts?.node_id ? queryNeighbors(opts.node_id) : queryAllEdges();
  const visible = edges.filter(e => e.weight >= minWeight);

  const nodeIds = new Set<string>();
  for (const e of visible) {
    nodeIds.add(e.source_id);
    nodeIds.add(e.target_id);
  }

  const labelById = new Map<string, string>();
  const pinnedById = new Map<string, boolean>();
  const dopaById = new Map<string, number>();

  for (const node of [...memory.getInnerSpiral(), ...memory.getArchive()]) {
    labelById.set(node.id, String(node.data).slice(0, 60));
    pinnedById.set(node.id, !!node.pinned);
    dopaById.set(node.id, node.dopamine);
  }

  const nodes: GraphNode[] = [];
  for (const id of nodeIds) {
    nodes.push({
      id,
      label: labelById.get(id) ?? id.slice(-8),
      pinned: pinnedById.get(id) ?? false,
      dopamine: dopaById.get(id) ?? 0.5,
    });
  }

  return {
    nodes,
    edges: visible.map(e => ({
      source: e.source_id,
      target: e.target_id,
      weight: Math.round(e.weight * 10000) / 10000,
      relation: e.relation,
      co_occurrence: e.co_occurrence,
    })),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findEdge(
  edges: AssociativeEdge[],
  source_id: string,
  target_id: string,
  relation: EdgeRelation,
): AssociativeEdge | undefined {
  return edges.find(e => e.source_id === source_id && e.target_id === target_id && e.relation === relation);
}

function clampWeight(w: number): number {
  return Math.max(0, Math.min(1.0, w));
}

function clampDopamine(d: number): number {
  return Math.max(0, Math.min(1.0, d));
}
