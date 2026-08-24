/**
 * mcp-registry.ts — Client-side MCP server registry for ADHD-Sage.
 *
 * Ported from /root/ADHD-Sage/src/server/routes/mcp.ts (Express + JSON file)
 * to a localStorage-backed registry so the Coming-home UI can list/register
 * MCP servers without a server runtime.
 */

export interface McpServerEntry {
  id: string;
  name: string;
  tools: string[];
  updated_at: string;
}

export interface McpRegistry {
  version: string;
  updated_at: string;
  servers: Record<string, McpServerEntry>;
}

const STORAGE_KEY = 'adhd_sage_mcp_registry';

function defaultRegistry(): McpRegistry {
  return { version: '1.0.0', updated_at: new Date().toISOString(), servers: {} };
}

export function getRegistry(): McpRegistry {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultRegistry();
    const parsed = JSON.parse(raw);
    return {
      ...defaultRegistry(),
      ...parsed,
      servers: parsed.servers || {},
    };
  } catch (err) {
    console.error('[MCP-REGISTRY] failed to load registry:', err);
    return defaultRegistry();
  }
}

function saveRegistry(data: McpRegistry): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('[MCP-REGISTRY] failed to persist registry:', err);
  }
}

export function listServers(): McpServerEntry[] {
  const registry = getRegistry();
  return Object.values(registry.servers).sort((a, b) => a.id.localeCompare(b.id));
}

export function totalServers(): number {
  return Object.keys(getRegistry().servers).length;
}

/**
 * Register or update an MCP server dynamically. Mirrors POST /api/mcp.
 */
export function registerServer(
  id: string,
  server: { name?: string; tools?: Array<{ name: string }> | string[] },
): McpRegistry {
  const registry = getRegistry();
  const toolNames = (server.tools || [])
    .map(t => (typeof t === 'string' ? t : t.name))
    .filter(Boolean);

  registry.servers = registry.servers || {};
  registry.servers[id] = {
    id,
    name: server.name || id,
    tools: toolNames,
    updated_at: new Date().toISOString(),
  };
  registry.updated_at = new Date().toISOString();

  saveRegistry(registry);
  return registry;
}

/** Remove a server from the registry. */
export function removeServer(id: string): McpRegistry {
  const registry = getRegistry();
  delete registry.servers[id];
  registry.updated_at = new Date().toISOString();
  saveRegistry(registry);
  return registry;
}
