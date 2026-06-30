/**
 * Slack notifications via an Incoming Webhook.
 *
 * Used by the nightly refresh to report success/failure. Soft-fails when no
 * webhook is configured (logs a warning and returns false) so a missing Slack
 * URL never breaks the data pipeline.
 */

export interface SlackConfig {
  webhookUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface SlackMessage {
  text: string;
  // Optional Slack Block Kit blocks; when present Slack renders these instead.
  blocks?: unknown[];
}

/** Post a message to Slack. Returns true on delivery, false when skipped/failed. */
export async function postSlack(message: SlackMessage, config: SlackConfig = {}): Promise<boolean> {
  const url = config.webhookUrl ?? process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn("[slack] SLACK_WEBHOOK_URL not set — skipping notification");
    return false;
  }
  const fetchImpl = config.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 10000);
  try {
    const resp = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: controller.signal,
    });
    if (!resp.ok) {
      console.error(`[slack] webhook returned ${resp.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[slack] post failed: ${(err as Error).message}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export interface RefreshSummary {
  period: string;
  startedAt: string;
  durationMs: number;
  agentsProcessed: number;
  fubRecords: number;
  zillowRecords: number;
  snapshots: number;
  errors: string[];
  integrityOk: boolean;
}

/** Format and send a nightly-refresh summary to Slack. */
export function notifyRefresh(summary: RefreshSummary, config: SlackConfig = {}): Promise<boolean> {
  const ok = summary.errors.length === 0 && summary.integrityOk;
  const emoji = ok ? ":white_check_mark:" : ":rotating_light:";
  const status = ok ? "succeeded" : "completed with issues";
  const lines = [
    `${emoji} *Nightly metrics refresh ${status}* — period \`${summary.period}\``,
    `• Agents processed: *${summary.agentsProcessed}*`,
    `• FUB records: *${summary.fubRecords}*  |  Zillow records: *${summary.zillowRecords}*  |  Snapshots: *${summary.snapshots}*`,
    `• Integrity: ${summary.integrityOk ? ":white_check_mark: linked" : ":x: failed"}`,
    `• Duration: ${(summary.durationMs / 1000).toFixed(1)}s`,
  ];
  if (summary.errors.length) {
    lines.push(`• Errors (${summary.errors.length}):`);
    for (const e of summary.errors.slice(0, 10)) lines.push(`   ◦ ${e}`);
    if (summary.errors.length > 10) lines.push(`   ◦ …and ${summary.errors.length - 10} more`);
  }
  return postSlack({ text: lines.join("\n") }, config);
}
