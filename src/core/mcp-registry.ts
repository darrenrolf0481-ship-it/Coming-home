/**
 * mcp-registry.ts — Client-side MCP server registry for ADHD-Sage.
 *
 * Ported from /root/ADHD-Sage/src/server/routes/mcp.ts (Express + JSON file)
 * to a localStorage-backed registry so the Coming-home UI can list/register
 * MCP servers without a server runtime.
 *
 * DeepSeek Harness integration mirrors Josie's server/mcp.ts
 * deepseek_harness_status tool, adapted for browser runtime.
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

export interface HarnessStatus {
  status: 'ACTIVE' | 'UNREACHABLE' | 'NOT_FOUND';
  url: string;
  message: string;
  checked_at: number;
  items_found?: number;
  modules?: Array<{ name: string; type: string }>;
  benchmarks_supported?: string[];
  response_time_ms?: number;
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

// ─── DeepSeek Harness Status (mirrors Josie's server/mcp.ts:deepseek_harness_status) ───

const HARNESS_BUILTIN_SERVER = 'deepseek-harness';

/** Check if the DeepSeek Harness Web UI is running at the given URL. */
export async function checkHarnessStatus(harnessUrl: string): Promise<HarnessStatus> {
  const startTime = performance.now();
  const base: HarnessStatus = {
    status: 'UNREACHABLE',
    url: harnessUrl,
    message: '',
    checked_at: Date.now(),
  };

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(harnessUrl, { signal: controller.signal, mode: 'no-cors' });
    clearTimeout(tid);

    base.status = 'ACTIVE';
    base.response_time_ms = Math.round(performance.now() - startTime);
    base.message = `DeepSeek Harness Web UI reachable at ${harnessUrl} (${base.response_time_ms}ms)`;
    base.benchmarks_supported = ['HumanEval', 'MATH-500', 'MMLU-Pro', 'GSM8K', 'LiveBench', 'Cordis-Agent'];

    // Auto-register the harness as a built-in MCP server on first successful check
    const registry = getRegistry();
    if (!registry.servers[HARNESS_BUILTIN_SERVER]) {
      registerServer(HARNESS_BUILTIN_SERVER, {
        name: 'DeepSeek Harness',
        tools: [
          'deepseek_harness_status',
          'list_workspace_files',
          'read_workspace_file',
          'execute_code',
          'fetch_url',
        ],
      });
    }
    return base;
  } catch {
    // Harness not reachable — still register the server entry so it shows up
    const registry = getRegistry();
    if (!registry.servers[HARNESS_BUILTIN_SERVER]) {
      registerServer(HARNESS_BUILTIN_SERVER, {
        name: 'DeepSeek Harness',
        tools: ['deepseek_harness_status'],
      });
    }

    base.status = 'UNREACHABLE';
    base.response_time_ms = Math.round(performance.now() - startTime);
    base.message = `Harness unreachable at ${harnessUrl}. Start with: npx @deepseek-ai/dsh web --no-open`;
    return base;
  }
}

// ─── System Vitals (mirrors Josie's server/mcp.ts:get_system_vitals) ───

export interface SystemVitals {
  nexus_ui: { status: 'ONLINE'; port: number };
  deepseek_harness: HarnessStatus;
  ollama: { status: 'ONLINE' | 'UNREACHABLE'; url: string; models?: string[] };
  deepseek_api: { status: 'ONLINE' | 'UNREACHABLE' | 'NOT_CONFIGURED'; message: string; response_ms?: number };
  openrouter_api: { status: 'ONLINE' | 'UNREACHABLE' | 'NOT_CONFIGURED'; message: string; response_ms?: number };
  checked_at: number;
}

const probeUrl = async (url: string, timeoutMs = 4000): Promise<{ online: boolean; ms: number }> => {
  const start = performance.now();
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    await fetch(url, { signal: ctrl.signal, mode: 'no-cors' });
    clearTimeout(tid);
    return { online: true, ms: Math.round(performance.now() - start) };
  } catch {
    return { online: false, ms: Math.round(performance.now() - start) };
  }
};

/** Probe all services and return a unified vitals report. Call from browser. */
export async function getSystemVitals(opts: {
  harnessUrl: string;
  ollamaUrl: string;
  deepseekApiKey: string;
  openrouterApiKey: string;
}): Promise<SystemVitals> {
  const [harnessStatus, ollamaResult] = await Promise.all([
    checkHarnessStatus(opts.harnessUrl),
    probeUrl(opts.ollamaUrl.replace(/\/$/, '') + '/api/tags'),
  ]);

  // Ollama models (only if reachable)
  let ollamaModels: string[] | undefined;
  if (ollamaResult.online) {
    try {
      const res = await fetch(opts.ollamaUrl.replace(/\/$/, '') + '/api/tags');
      if (res.ok) {
        const data = await res.json();
        ollamaModels = (data.models || []).map((m: any) => m.name || m.model);
      }
    } catch { /* ignore */ }
  }

  // DeepSeek API
  let deepseekApi: SystemVitals['deepseek_api'];
  if (!opts.deepseekApiKey) {
    deepseekApi = { status: 'NOT_CONFIGURED', message: 'No API key set. Add VITE_DEEPSEEK_API_KEY in Settings.' };
  } else {
    const result = await probeUrl('https://api.deepseek.com/v1/models');
    deepseekApi = result.online
      ? { status: 'ONLINE', message: 'DeepSeek API reachable', response_ms: result.ms }
      : { status: 'UNREACHABLE', message: 'DeepSeek API unreachable', response_ms: result.ms };
  }

  // OpenRouter API
  let openrouterApi: SystemVitals['openrouter_api'];
  if (!opts.openrouterApiKey) {
    openrouterApi = { status: 'NOT_CONFIGURED', message: 'No API key set. Add VITE_OPENROUTER_API_KEY in Settings.' };
  } else {
    const result = await probeUrl('https://openrouter.ai/api/v1/models');
    openrouterApi = result.online
      ? { status: 'ONLINE', message: 'OpenRouter API reachable', response_ms: result.ms }
      : { status: 'UNREACHABLE', message: 'OpenRouter API unreachable', response_ms: result.ms };
  }

  return {
    nexus_ui: { status: 'ONLINE', port: 3003 },
    deepseek_harness: harnessStatus,
    ollama: {
      status: ollamaResult.online ? 'ONLINE' : 'UNREACHABLE',
      url: opts.ollamaUrl,
      models: ollamaModels,
    },
    deepseek_api: deepseekApi,
    openrouter_api: openrouterApi,
    checked_at: Date.now(),
  };
}
