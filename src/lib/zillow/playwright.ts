/**
 * Playwright backend for the Zillow scraper.
 *
 * Logs into the FUB web UI, opens the Zillow Performance Report, downloads its
 * CSV export, and returns parsed rows. `playwright` is an *optional* runtime
 * dependency: this file is only imported when production scraping actually runs,
 * and it fails with a clear, actionable message if the package isn't installed.
 *
 * Mirrors the proven flow in the Monthly-Metrics repo
 * (`scripts/fub_zillow_csv_pull.py`). Selectors live here so the parsing layer
 * stays pure.
 */

import type { ReportRow, ScrapeConfig } from "./scraper";

const FUB_LOGIN_URL = "https://app.followupboss.com/login";

/** Parse CSV text into rows keyed by header. Minimal RFC-4180-ish reader. */
export function parseCsv(text: string): ReportRow[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const split = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  };

  const headers = split(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row: ReportRow = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

export async function fetchReportRows(cfg: ScrapeConfig): Promise<ReportRow[]> {
  if (!cfg.webUser || !cfg.webPassword) {
    throw new Error("Zillow scrape requires webUser and webPassword (FUB web login).");
  }
  if (!cfg.reportUrl) {
    throw new Error(
      "Zillow scrape requires reportUrl (the FUB Zillow Performance Report page). " +
        "Set ZILLOW_REPORT_URL after locating it once in the FUB UI.",
    );
  }

  let chromium: { launch: (opts: object) => Promise<unknown> };
  try {
    // Indirected so bundlers/TS don't hard-require the optional dependency.
    const pkg = "playwright";
    ({ chromium } = (await import(/* webpackIgnore: true */ pkg)) as {
      chromium: { launch: (opts: object) => Promise<unknown> };
    });
  } catch {
    throw new Error(
      "playwright is not installed. Run `npm i -D playwright && npx playwright install chromium` " +
        "to enable Zillow scraping, or run the pipeline with ZILLOW_MOCK=1.",
    );
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const browser: any = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    // 1. Log in to FUB.
    await page.goto(FUB_LOGIN_URL, { waitUntil: "domcontentloaded" });
    await page.fill('input[type="email"], input[name="email"]', cfg.webUser);
    await page.fill('input[type="password"], input[name="password"]', cfg.webPassword);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => undefined),
      page.click('button[type="submit"]'),
    ]);

    // 2. Open the Zillow Performance Report.
    await page.goto(cfg.reportUrl, { waitUntil: "networkidle" });

    // 3. Trigger the CSV export and capture the download.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('text=/export|download/i').catch(() => undefined),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const csv = Buffer.concat(chunks).toString("utf-8");
    return parseCsv(csv);
  } finally {
    await browser.close();
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
