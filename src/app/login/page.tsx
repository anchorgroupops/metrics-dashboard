export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-md py-10">
      <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-extrabold text-clear-water" style={{ fontFamily: "'Collier', Georgia, serif" }}>
          Sign in
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter the email address on your Follow Up Boss account. We&apos;ll email you a secure sign-in link — no password
          needed.
        </p>

        {sp.sent && (
          <div className="mt-4 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
            If that address is on the team, a sign-in link is on its way. Check your inbox (it expires in 15 minutes).
          </div>
        )}
        {sp.error && (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            That link was invalid or expired. Request a new one below.
          </div>
        )}

        <form method="post" action="/api/auth/request" className="mt-6 space-y-3">
          <input
            type="email"
            name="email"
            required
            placeholder="you@youremail.com"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-clear-water"
          />
          <button
            type="submit"
            className="w-full rounded-2xl bg-clear-water px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"
          >
            Email me a sign-in link
          </button>
        </form>
      </div>
    </div>
  );
}
