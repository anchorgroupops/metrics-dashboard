/**
 * NotebookLM integration adapter.
 *
 * NotebookLM has no stable public API as of this build, so this adapter defines
 * the integration boundary the pipeline will use and ships a safe no-op default.
 * When an API (or the Enterprise/Agentspace surface) becomes available, swap
 * `defaultBackend` for a real implementation — callers and the data contract
 * below stay unchanged.
 *
 * Intended use: push a per-period performance digest (the reconciled snapshots)
 * into a NotebookLM notebook as a source, so leadership can ask natural-language
 * questions over the metrics history.
 */

export interface NotebookSource {
  title: string;
  // Markdown/plain-text content uploaded as a NotebookLM source.
  content: string;
}

export interface NotebookLmConfig {
  apiKey?: string;
  notebookId?: string;
  backend?: NotebookLmBackend;
}

export interface NotebookLmBackend {
  uploadSource(source: NotebookSource, config: NotebookLmConfig): Promise<{ ok: boolean; id?: string }>;
}

/** No-op backend: records intent without making a network call. */
const noopBackend: NotebookLmBackend = {
  async uploadSource(source, config) {
    if (!config.apiKey || !config.notebookId) {
      console.warn(
        "[notebooklm] not configured (NOTEBOOKLM_API_KEY / NOTEBOOKLM_NOTEBOOK_ID) — skipping upload",
      );
      return { ok: false };
    }
    console.info(`[notebooklm] (stub) would upload source "${source.title}" (${source.content.length} chars)`);
    return { ok: true, id: "stub" };
  },
};

let defaultBackend: NotebookLmBackend = noopBackend;

/** Swap the backend (e.g. once a real NotebookLM API is wired). */
export function setNotebookLmBackend(backend: NotebookLmBackend): void {
  defaultBackend = backend;
}

export async function uploadDigest(
  source: NotebookSource,
  config: NotebookLmConfig = {},
): Promise<{ ok: boolean; id?: string }> {
  const backend = config.backend ?? defaultBackend;
  return backend.uploadSource(source, {
    apiKey: config.apiKey ?? process.env.NOTEBOOKLM_API_KEY,
    notebookId: config.notebookId ?? process.env.NOTEBOOKLM_NOTEBOOK_ID,
    backend,
  });
}

/** Build a plain-text performance digest suitable for a NotebookLM source. */
export function buildDigest(
  period: string,
  rows: Array<{ name: string; readiness: number | null; status: string; points: number }>,
): NotebookSource {
  const body = rows
    .map(
      (r) =>
        `- ${r.name}: readiness ${r.readiness == null ? "N/A" : r.readiness.toFixed(0)}, ` +
        `status ${r.status}, leaderboard ${r.points} pts`,
    )
    .join("\n");
  return {
    title: `Anchor Group performance digest — ${period}`,
    content: `# Performance digest ${period}\n\n${body}\n`,
  };
}
