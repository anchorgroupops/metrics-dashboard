/**
 * Magic-link email delivery via Resend (raw HTTP, injectable fetch — works for
 * any recipient provider: Gmail/Outlook/Yahoo/etc.). Server-only.
 *
 * Soft-fails: when RESEND_API_KEY is unset it logs the link (dev) and returns
 * false rather than throwing, so local development needs no email config.
 */

export interface SendMagicLinkConfig {
  apiKey?: string;
  from?: string;
  fetchImpl?: typeof fetch;
  devLog?: boolean;
}

const RESEND_URL = "https://api.resend.com/emails";

function emailHtml(url: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1a1a">
    <h2 style="color:#046568;margin:0 0 8px">The Anchor Team — sign in</h2>
    <p style="color:#444">Click below to securely sign in to your performance dashboard. This link expires in 15 minutes and can be used once.</p>
    <p style="margin:24px 0">
      <a href="${url}" style="background:#046568;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">Sign in</a>
    </p>
    <p style="color:#888;font-size:13px">If you didn't request this, you can ignore this email.</p>
  </div>`;
}

/** Send a magic-link email. Returns true on delivery, false when skipped/failed. */
export async function sendMagicLinkEmail(
  to: string,
  url: string,
  config: SendMagicLinkConfig = {},
): Promise<boolean> {
  const apiKey = config.apiKey ?? process.env.RESEND_API_KEY;
  const from = config.from ?? process.env.EMAIL_FROM ?? "metrics@anchorteam.com";
  const devLog = config.devLog ?? process.env.DEV_LOG_MAGIC_LINK === "1";

  if (!apiKey) {
    if (devLog) console.info(`[auth] (dev) magic link for ${to}: ${url}`);
    else console.warn("[auth] RESEND_API_KEY not set — magic-link email not sent");
    return false;
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  try {
    const resp = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: "Sign in to your Anchor Team dashboard",
        html: emailHtml(url),
      }),
    });
    if (!resp.ok) {
      console.error(`[auth] Resend ${resp.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[auth] magic-link send failed: ${(err as Error).message}`);
    return false;
  }
}
